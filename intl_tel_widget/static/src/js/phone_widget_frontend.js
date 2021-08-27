var input = document.querySelector(".intl_tel_widget");
var phone_output = document.querySelector(".phone_output");
var phone_value = document.querySelector(".phone_value");

var iti = window.intlTelInput(input, {
    utilsScript: "https://cdn.jsdelivr.net/npm/intl-tel-input@17.0.3/build/js/utils.js",
});

// store the instance variable so we can access it in the console e.g. window.iti.getNumber()
window.iti = iti;

var handleChange = function() {
    var text = (iti.isValidNumber()) ? "Correct: " + iti.getNumber() : "Please enter a valid number";
    var textNode = document.createTextNode(text);
    phone_output.innerHTML = "";
    phone_output.appendChild(textNode);
    phone_value.value = (iti.isValidNumber()) ? iti.getNumber() : "Please enter a valid number";
};

// listen to "keyup", but also "change" to update when the user selects a country
input.addEventListener('change', handleChange);
input.addEventListener('keyup', handleChange);