const passwordInput = document.getElementById('newPassword');
        const passwordChecker = document.getElementById('confirmPassword');
        const passwordStrengthIndicator = document.getElementById('password-strength');
        const passwordReq1 = document.getElementById('password-req1');
        const passwordReq2 = document.getElementById('password-req2');
        const passwordReq3 = document.getElementById('password-req3');
        const passwordReq4 = document.getElementById('password-req4');
        const passwordMatchingIndicator = document.getElementById('passwords-match');
    
        passwordInput.addEventListener('input', function() {
          const password = passwordInput.value;
          const strength = checkPasswordStrength(password);
          passwordStrengthIndicator.textContent = `Password Strength: ${strength}`;
          //checking password requirements
          checkPasswordRequirements(password);
        });

        passwordChecker.addEventListener('input', function() {
            const password1 = passwordChecker.value;
            const password2 = passwordInput.value;
            console.log(password1, password2);
          if(password1 != password2) {
            passwordMatchingIndicator.style.color = "red";
            passwordMatchingIndicator.textContent = `Passwords Don't Match`;
            
          } else {
            passwordMatchingIndicator.style.color = "green";
            passwordMatchingIndicator.textContent = `Passwords Match!`;
            
          }
        });

        function checkPasswordRequirements(password) {
            if(password.length > 10){
                passwordReq1.style.color = "green";
            } else passwordReq1.style.color = "red";
            if(/[A-Z]/.test(password) && /[a-z]/.test(password)){
                passwordReq2.style.color = "green";
            } else passwordReq2.style.color = "red";
            if(/\d/.test(password)){
                passwordReq3.style.color = "green";
            } else passwordReq3.style.color = "red";
            if(password.match(/[^a-zA-Z0-9]/)){
                passwordReq4.style.color = "green";
            } else passwordReq4.style.color = "red";
        }
        function checkPasswordStrength(password) {
          // Add your password strength criteria here
          // For example, you can check for length, presence of uppercase, lowercase, digits, etc.
          if(password.length > 10 && /\d/.test(password) && /[A-Z]/.test(password) && password.match(/[^a-zA-Z0-9]/)){
            passwordStrengthIndicator.style.color = "green";
            return 'Strong';
          } else if(password.length > 5 && /\d/.test(password)){
            passwordStrengthIndicator.style.color = "orange";
            return 'Moderate';
          } else{
            passwordStrengthIndicator.style.color = "red";
            return 'Weak';
          }
        }