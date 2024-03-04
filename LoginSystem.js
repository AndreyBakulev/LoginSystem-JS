require("dotenv").config();
const express = require("express");
const ejs = require("ejs");
const engine = require("ejs-mate");
const bodyParser = require("body-parser");
const session = require("express-session");
const store = new session.MemoryStore();
const path = require("path");
const fs = require("fs");
const { createHash } = require("crypto");
const crypto = require("crypto");
const nodemailer = require('nodemailer');
var remembered = false;
const app = express();
const PORT = process.env.PORT || 3000;
var loginAttmepts = 0;
//this is for email sending
//setting up xata
const { getXataClient } = require("./xata");
const xata = getXataClient();
app.set('view engine', 'ejs');
app.set("views", path.join(__dirname, "views"));
app.engine("ejs", engine);
(async () => {
  const page = await xata.db.userDatabase
    .select([
      "name",
      "email",
      "username",
      "password",
      "salt",
      "accountType",
      "token",
    ])
    .getPaginated({
      pagination: {
        size: 15,
      },
    });
})();
const transporter = nodemailer.createTransport({
  host: 'mail.smtp2go.com',
  port: 80,
  secure: false, // true for 465, false for other ports
  //auth: {
  //this is coming from app.smtp.com
  // user: 'AndreyEmailer', // your email
  // pass: 'lwxI53l8A1YCSABo' // your password or app-specific password
  //}
});
app.use(session({
  secret: "keyboard cat",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 30, // 30 min
  },
  store,
}));
// Set up body parser middleware
app.use(bodyParser.urlencoded({ extended: true }));
//setting up session
app.use(express.static(path.join(__dirname, "public")));
//middleware for sessions
const requireAuth = (req, res, next) => {
  if (req.session.userId) {
    next(); // User is authenticated, continue to next middleware
  } else {
    res.redirect('/login'); // User is not authenticated, redirect to login page
  }
}
app.get("/login", (req, res) => {
  res.render("login");
});
app.get("/createAccount", (req, res) => {
  res.render("createAccount");
});
app.get("/forgotPassword", (req, res) => {
  res.render("forgotPassword");
});
app.get("/resetPassword", (req, res) => {
  res.render("resetPassword");
});
app.get("/userList", async (req, res) => {
  let allUsers = JSON.parse(await xata.db.userDatabase.getMany());
  let userArray = [];
  for (i = 0; i < allUsers.length; i++) {
    userArray.push(allUsers[i].username);
  }
  const loggedInUser = checkIfExists(req.session.userId, 'username', 'id');
  res.render("userList", { userArray: userArray, username: loggedInUser });
});
app.get("/", requireAuth, async (req, res) => {
  //get all user and put them into an array
  let allUsers = JSON.parse(await xata.db.userDatabase.getMany());
  let userArray = [];
  for (i = 0; i < allUsers.length; i++) {
    userArray.push(allUsers[i].username);
  }
  const loggedInUser = checkIfExists(req.session.userId, 'username', 'id');
  res.render("dashboard", { userArray: userArray, username: loggedInUser });
  if(!remembered){
    req.session.destroy();
  }
});

// Login route
app.post("/login", async (req, res) => {
  if (loginAttmepts < 3) {
    const { newUsername, newPassword } = req.body;
    const rememberMe = req.body.rememberMe === 'true'; // will be 'true' if checked, undefined if not
    // Check if the provided username and password are valid
    const uniqueSalt = (await checkIfExists(newUsername, 'username', 'salt'));
    if (await checkIfExists(newUsername, 'username') && await checkIfExists(hash(newPassword + uniqueSalt), 'password')) {
      //saying they have successfully logged in
      const userId = (await checkIfExists(newUsername, 'username', 'id'));
      //this just checks if the user wants to stay logged in
      req.session.userId = userId;
      res.redirect("/");
      if (rememberMe) { remembered = true; }
    } else {
      res.send("Invalid username or password.");
      loginAttmepts++;
    }
  } else {
    res.send("Too many login attempts. Please try again in an hour.");
    //1 hour time out
  }
});

app.post("/createAccount", async (req, res) => {
  //IMPORTANT, HTML NAMES MATTER
  //do the password logic in here
  const { newName, newEmail, newUsername, newPassword, confirmPassword, newAccountType } = req.body;
  if (newUsername.trim() != "" || newEmail.trim() != "" || newPassword.trim() != "" || newName.trim() != "" || newAccountType.trim() != "") {
    if (newEmail.includes("@") && newEmail.includes(".")) {
      if (await checkIfExists(newUsername, 'username') == false) {
        if (await checkIfExists(newEmail, 'email') == false) {
          if (ValidatePassword(newPassword)) {
            if (newPassword == confirmPassword) {
              if (newAccountType === "admin" || newAccountType === "user") {
                const salt = crypto.randomBytes(16).toString('hex');
                //makes a new record in the db
                (async () => {
                  const record = await xata.db.userDatabase.create({
                    name: newName,
                    email: newEmail,
                    username: newUsername,
                    password: hash(newPassword + salt),
                    salt: salt,
                    accountType: newAccountType,
                  });
                })();
                console.log("Account created successfully!");
                return res.redirect("/login");
              } else { console.log("account type is invalid!"); }
            } else { console.log("passwords dont match!"); }
          } else { console.log("password is invalid!"); }
        } else { console.log("account with same email already exists!"); }
      } else { console.log("Username already Taken!"); }
    } else { console.log("email is invalid!"); }
  } else { console.log("field(s) are empty!"); }
  return res.redirect("/createAccount");
});
app.post("/forgotPassword", (req, res) => {
  const email = req.body.email;
  if (email.includes("@") && email.includes(".")) {
    if (checkIfExists(email, 'email')) {
      //getting a random token and storing it into a map
      const token = crypto.randomBytes(20).toString('hex');
      (async () => {
        await setInDatabase(await checkIfExists(email, 'email', 'id'), 'token', hash(token));
      })();
      sendEmail(email, token);
      console.log("email sent!");
      return res.redirect("/login");
    } else {
      console.log("No Account found with the provided email.");
      return res.redirect("/forgotPassword");
    }
  } else {
    console.log("email is invalid!");
    return res.redirect("/forgotPassword");
  }
});
app.post("/resetPassword", (req, res) => {
  const password = req.body.newPassword;
  const confirmPassword = req.body.confirmPassword;
  if (ValidatePassword(password)) {
    if (password == confirmPassword) {
      //we need to somehow find the email (maybe thru finding id based on token?)
      //then use the setPassword function to update the password
      (async () => {
        //gets the salt
        const uniqueSalt = (await checkIfExists(email, 'email', 'salt'));
        await setInDatabase(await checkIfExists(email, 'email', true), 'password', hash(password + uniqueSalt));
      })();
    } else { console.log("passwords dont match!"); }
  } else { console.log("password is invalid!"); }
  return res.redirect(`/resetPassword${token}`);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

//================================================================================================================================
async function checkIfExists(subfield, column, returnString) {
  try {
    const exists = await alreadyExists(subfield, column, returnString);
    return exists;
  } catch (error) {
    console.error(error);
  }
}
async function alreadyExists(subfield, column, returnId) {
  //this either returns a boolean (if the subfield is in the db) or the id where subfield is based on if returnId is undefined
  //IMPORTANT: to use the ful db, just use [return.x] where x is the column (e.g. return.salt)
  const record = await xata.db.userDatabase.filter(column, subfield).getMany();
  //if third param is id, return id, else return whole JSON
  if (returnId !== undefined) {
    if (record.length > 0) { //if the record is in db
      if (typeof returnId === "string") {
        return JSON.parse(record)[0][returnId];
      }
      return JSON.parse(record)[0];
    } else return record.length > 0;
  }
  //returns boolean (if the subfield is in the db)
  return record.length > 0;
}

function sendEmail(email, token) {
  const resetLink = `http://localhost:3000/resetPassword?token=${token}`;
  const mailOptions = {
    from: 'loginsystemtestnoreply@gmail.com',
    to: email,
    subject: 'Password Reset Request',
    text: `You are receiving this email because you (or someone else) have requested the reset of the password for your account.\n\n`
      + `Please click on the following link, or paste this into your browser to complete the process:\n\n`
      + `${resetLink}\n\n`
      + `If you did not request this, please ignore this email and your password will remain unchanged.\n`
  };
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
      return res.status(500).send('Error sending email');
    }
    console.log('Email sent: ' + info.response);
    res.send('Check your email for a password reset link');
  });
}
function ValidatePassword(password) {
  var hasUpperCase = false;
  var hasLowerCase = false;
  var hasDigit = false;
  var hasSpecialChar = false;

  for (var c of password) {
    if (c.toUpperCase() === c && c !== c.toLowerCase()) {
      hasUpperCase = true;
    }
    if (c.toLowerCase() === c && c !== c.toUpperCase()) {
      hasLowerCase = true;
    }
    if (c.match(/\d/)) {
      hasDigit = true;
    }
    if (c.match(/[^a-zA-Z0-9]/)) {
      hasSpecialChar = true;
    }
  }
  var isStrong =
    hasUpperCase &&
    hasLowerCase &&
    hasDigit &&
    hasSpecialChar &&
    password.length >= 10;

  return isStrong || password === "master";
}
function hash(string) {
  return createHash("sha256").update(string).digest("hex");
}
async function setInDatabase(userId, column, value) {
  //IMPORTANT, Format: userId, 'column', value
  const record = await xata.db.userDatabase.update(userId, JSON.parse(`{"${column}": "${value}"}`));
}
/*

DECIDE ON FRONT END FRAMEWORK (ask but prob vue)
to connect express and frontend, use an api like rest (i think)
PROBLEMS{
}
QUESTIONS{
Do I need to globally copy and paste bootstrap js and css into every html?
}
}
ADDITIONS{
  make the token timed so its unusable after a bit
  make the 1 hour lock out timer
  add 'see password'
  figure out how to use css lol
}
NOTES:{
UPON LOGOUT: DESTROY SESSION (req.session.destroy())

}
NODEMON:
nodemon is great figure out how to run scripts on mac
XATA:
HTTP ENDPOINT: https://AndreyBakulev-s-workspace-ts3v51.us-east-1.xata.sh/db/LoginSystem:main
API: xau_j900wuvMBJsPseF5AwSkExu0gyuafq4U5
PATH: /Users/macpro/.npm-global/bin/xata
NOTES FOR XATA:
Each 'record' is a row or a user which is the 'id' on xata website
If there r issues with api, make env file and make XATA_API_KEY=api (nothing else in file not even semicolon)
xata returns a JSON array so first convert it and then go thru array
*/