require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const { createHash } = require("crypto");
const crypto = require("crypto");
const nodemailer = require('nodemailer');
var name = "";
const passwordResetTokens = new Map();
const app = express();
const PORT = process.env.PORT || 3000;
var loginAttmepts = 0;
//this is for email sending
//setting up xata
const { getXataClient } = require("./xata");
const xata = getXataClient();
( async ()=> {
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

// Set up body parser middleware
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));
// Function to check if the provided username and password are valid
//app.set("views",path.join(__dirname, "public"));

app.get("/login", (req, res) => {
  res.sendFile(__dirname + "/public/login.html");
});
app.get("/createAccount", (req, res) => {
  res.sendFile(__dirname + "/public/createAccount.html");
});
app.get("/forgotPassword", (req, res) => {
  res.sendFile(__dirname + "/public/forgotPassword.html");
});
app.get("/resetPassword/", (req, res) => {
  console.log(passwordResetTokens);
  res.sendFile(__dirname + "/public/resetPassword.html");
});
// Login route
app.post("/login", (req, res) => {
  //IMPORTANT, HTML NAMES MATTER
  if (loginAttmepts < 3) {
    const { newUsername, newPassword } = req.body;
    // Check if the provided username and password are valid
    if (checkIfExists(newUsername,'username') && checkIfExists(newPassword,'password')) {
      res.send("Valid username and password. Welcome " + name + "!");
    } else {
      res.send("Invalid username or password.");
      loginAttmepts++;
    }
  } else {
    res.send("Too many login attempts. Please try again in an hour.");
    //1 hour time out
  }
});

app.post("/createAccount", async(req, res) => {
  //IMPORTANT, HTML NAMES MATTER
  //do the password logic in here
  const { newName, newEmail, newUsername, newPassword, confirmPassword, newAccountType } = req.body;
  if (newUsername.trim() != "" || newEmail.trim() != "" || newPassword.trim() != "" || newName.trim() != "" || newAccountType.trim() != "") {
    if (newEmail.includes("@") && newEmail.includes(".")) {
      if (await checkIfExists(newUsername,'username') == false) {
        if (await checkIfExists(newEmail,'email') == false) {
          if (ValidatePassword(newPassword)) {
            if (newPassword == confirmPassword) {
              if (newAccountType === "admin" || newAccountType === "user") {
                const salt = crypto.randomBytes(16).toString('hex');
                //makes a new record in the db
                ( async ()=> {
                const record = await xata.db.userDatabase.create({
                  name: newName,
                  email: newEmail,
                  username: newUsername,
                  password: hash(newPassword+salt),
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
    if(checkIfExists(email,'email')) {
      //getting a random token and storing it into a map
      const token = crypto.randomBytes(20).toString('hex');
      passwordResetTokens.set(email, hash(token));
      (async () => {
      const record = await xata.db.userDatabase.update(await checkIfExists(email,'email',true), {token: hash(token)});
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
  const token = req.query.token;
  const password = req.body.newPassword;
  const confirmPassword = req.body.confirmPassword;
  if (ValidatePassword(password)) {
    if (password == confirmPassword) {
      setNewPassword(getUserEmailByToken(token), password);
    } else { console.log("passwords dont match!"); }
  } else { console.log("password is invalid!"); }
  return res.redirect(`/resetPassword${token}`);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

//================================================================================================================================
async function checkIfExists(subfield,column,returnString) {
  try {
    const exists = await alreadyExists(subfield,column,returnString);
    return exists;
  } catch (error) {
    console.error(error);
  }
}
async function alreadyExists(subfield,column,returnString) {
  //method overloading with returnString (boolean) so I can get the actual value
  const record = await xata.db.userDatabase.filter(column, subfield).getMany();
  if(returnString !== undefined) {
    const string = JSON.parse(record)[0].id;
    return string;
  }
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
//finds n-th position of a substring in a string
function getPosition(string, subString, index) {
  return string.split(subString, index).join(subString).length;
}
function hash(string) {
  return createHash("sha256").update(string).digest("hex");
}
function getUserEmailByToken(token) {
  // Iterate over the entries of the passwordResetTokens map
  for (const [email, storedToken] of passwordResetTokens.entries()) {
    // Check if the stored token matches the provided token
    if (storedToken === token) {
      // Return the username associated with the token
      return email;
    }
  }
  // If no matching token is found, return null or handle appropriately
  return null;
}
function setNewPassword(email, newPassword) {
  // Read the contents of the 'users.txt' file
  const usersFile = fs.readFileSync(
    path.join(__dirname, "public", "users.txt"),
    "utf8"
  );
  // Split the file contents into lines
  const users = usersFile.trim().split("\n");
  // Check each line for a match
  for (const user of users) {
    if (user.includes(email)) {
      let beforeSubstring = user.slice(0, getPosition(user, ":", 4) + 1);
      let afterSubstring = user.slice(getPosition(user, ",", 4));
      console.log(beforeSubstring);
      console.log(afterSubstring);
      user = beforeSubstring + hash(newPassword + salt) + afterSubstring;
    }
  }
}
/*
PROBLEMS{
}
ADDITIONS{
  add 'see password'
  figure out how to use css lol
}
XATA:
HTTP ENDPOINT: https://AndreyBakulev-s-workspace-ts3v51.us-east-1.xata.sh/db/LoginSystem:main
API: xau_j900wuvMBJsPseF5AwSkExu0gyuafq4U5
PATH: /Users/macpro/.npm-global/bin/xata
NOTES FOR XATA:
Each 'record' is a row or a user which is the 'id' on xata website
If there r issues with api, make env file and make XATA_API_KEY=api (nothing else in file not even semicolon)
xata returns a JSON array so first convert it and then go thru array
*/