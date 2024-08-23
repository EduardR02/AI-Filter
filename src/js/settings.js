import {auto_resize_textfield_listener, update_textfield_height} from "./utils.js";


let existing_settings = {};


init();


function init() {
    init_values();
    let saveButton = document.getElementById('buttonSave');
    saveButton.addEventListener('click', function() {
        save();
    });
}


function init_values() {
    chrome.storage.local.get(['api_key', 'temperature', 'threshold'], function(res) {
        res.api_key = res.api_key || '';
        res.temperature = res.temperature || 0.5;
        res.threshold = res.threshold || 7;
        existing_settings = res;
        document.getElementById('temperature').value = res.temperature;
        if (res.api_key) document.getElementById('api-key-input').placeholder = 'Existing key (hidden)';
        document.getElementById('threshold').value = res.threshold;
    });
    textarea_setup();
}


function save() {
    save_settings();
}


function save_settings() {
    let settings = {};
    settings.temperature = parseFloat(document.getElementById('temperature').value.trim());
    const api_key_input = document.getElementById('api-key-input');
    settings.api_key = api_key_input.value.trim();
    settings.threshold = parseInt(document.getElementById('threshold').value.trim());
    settings.prompt = document.getElementById('customize-prompt').value.trim();
    for (let key in settings) {
        if (settings[key] === existing_settings[key] || settings[key] === undefined ||
            settings[key] === NaN || settings[key] === "") {
            delete settings[key];
        }
        else {
            existing_settings[key] = settings[key];
        }
    }
    if (settings.api_key) api_key_input.placeholder = 'Existing key (hidden)';
    chrome.storage.local.set(settings);
}


function textarea_setup() {
    auto_resize_textfield_listener('customize-prompt');
    textarea_update();
}


function textarea_update() {
    let textarea = document.getElementById('customize-prompt');
    chrome.storage.local.get("prompt").then((result) => {
        let text = result.prompt || '';
        textarea.value = text;
        update_textfield_height(textarea);
        existing_settings.prompt = text;
    });
}