import { get_lifetime_tokens } from "./utils.js";


run_on_init();


function run_on_init() {
	let button = document.getElementById("buttonOnOff");
	button.addEventListener("click", function() {
		toggle_on_off(function(isOn) {
			update_colors(isOn);
			update_button_text(isOn);
		});
		return true;
	});

	let tokensValue = document.getElementById("tokensValue");
    get_lifetime_tokens(function(res) {
        tokensValue.innerText = res.input + " | " + res.output;
    });

	get_on_off(function(isOn) {
		update_colors(isOn);
		update_button_text(isOn);
	});
}


function update_button_text(isOn) {
	let button = document.getElementById("buttonOnOff");
	button.innerHTML = isOn ? "<span>On </span>" : "<span>Off </span>";
}


function update_colors(isOn) {
	const arr = document.getElementsByClassName('button');
	if (isOn) {
		Array.prototype.forEach.call(arr, el => {
			el.style.setProperty("--check-primary", "#61afef");
			el.style.setProperty("--check-secondary", "#ef596f");
		});
	}
	else {
		Array.prototype.forEach.call(arr, el => {
			el.style.setProperty("--check-primary", "#ef596f");
			el.style.setProperty("--check-secondary", "#61afef");
		});
	}
}


function toggle_on_off(callback) {
	chrome.storage.sync.get('OnOffToggle', function(res) {
		console.log("res:",res);
		let OnOff = res.OnOffToggle ? false : true;
		console.log("OnOff:",OnOff);
		callback(OnOff);
		chrome.storage.sync.set({OnOffToggle: OnOff}, function() {
			console.log('OnOff is set to ' + OnOff);
		});
	});
}

function get_on_off(callback) {
	chrome.storage.sync.get('OnOffToggle', function(res) {
		callback(res.OnOffToggle);
		console.log('Value of OnOffToggle is ' + res.OnOffToggle);
	});
}