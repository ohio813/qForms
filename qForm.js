// TODO: ADD support for CSS, textarea rows/cols by CSS, finish focusOnRequiredField to show error

var formJSON = {}; // This is the form JSON data with all questions.
var formMeta = {}; // This is the meta data for language and UI.

// UTILS

function _formatText(text) {
    return text.replace(/(?:\r\n|\r|\n)/g, '<br>');
}

// GLOBALS:
// ----------------

// This holds full user's input state, it's a double dictionary.
// First level is segment-index. Second level is the tag of the input field. Value depends upon type (normally it's the index of the chosen radio/dropdown, or text, etc).
var formState = {};
// Holds the array of all fields of the *currently displayed* elements in the segment (from top to bottom for appropriate UX).
var segmentFields = []; // [field name, segmentIndex, maxOptions, isRequired]

// A helper bookkeeping segment index to keep browser navigation in sync
// with our own 'back' and 'next' buttons.
var lastVisitedSegment = 0;

// INPUT STATE helper functions

function addState(segIndex, key, value) {
    if (!formState.hasOwnProperty(segIndex)) formState[segIndex] = {};
    formState[segIndex][key] = value;
}

function removeState(segIndex, key) {
    if (formState.hasOwnProperty(segIndex)) {
        delete formState[segIndex][key];
    }
}

function generateName(element, segIndex, eIndex) {
    return "q_" + element.type + "_" + segIndex + "_" + eIndex;
}

function extractName(text) {
    return text.split("_").slice(1); // Break by underscore delimiters and skip tagging letter.
}

function addField(fieldName, segIndex, maxOptions, isRequired) {
    segmentFields.push([fieldName, segIndex, maxOptions, isRequired]);
}

function resetFields() {
    segmentFields = [];
}

// This function is called every time a field has new input.
function saveControlState(control) {
    // Save the state of the new input for this control.
    // It is required to track it live in case the user hits the broswer's builtin 'forward' or 'back'
    // navigation buttons bypassing our own buttons, so we need to save state every time.
    saveInputState(control.name);
}

// This function stores the status of the relevant HTML control(s) in the current page.
function saveInputState(fieldName) {
    var i;
    // Lookup the field in our records.
    for (i = 0; i < segmentFields.length; i++) {
        var fieldInfo = segmentFields[i];
        var curFieldName = fieldInfo[0];
        var isRequired = fieldInfo[3];
        var tagInfo = extractName(fieldName);
        var type = tagInfo[0];
        var segIndex = fieldInfo[1];

        // Skip this field if it doesn't match.
        if (curFieldName != fieldName) {
            if (!((fieldName.search("checkbox") != -1) && (fieldName.search(curFieldName) != -1))) continue;
            fieldName = curFieldName;
        }

        if ((type == "inputline") || (type == "inputmulti")) {
            var value = document.getElementsByName(fieldName)[0].value;
            if (value.length > 0) addState(segIndex, fieldName, value);
            else removeState(segIndex, fieldName);
        } else if (type == "checkbox") {
            var checks = document.querySelectorAll("input[name^=" + fieldName + "]:checked");
            if (checks.length > 0) {
                var results = [];
                for (var j = 0; j < checks.length; j++) {
                    results.push(checks[j].value);
                }
                addState(segIndex, fieldName, results);
            } else removeState(segIndex, fieldName);
        } else if (type == "multi") {
            var multis = document.querySelectorAll("input[name=" + fieldName + "]:checked");
            if (multis.length > 0) addState(segIndex, fieldName, multis[0].value);
            else removeState(segIndex, fieldName);
        } else if (type == "dropdown") {
            var value = document.getElementsByName(fieldName)[0].selectedIndex;
            if (isRequired) {
                // If it's required and it's the default value don't record it.
                if (value > 0) addState(segIndex, fieldName, value);
                // If user changed back to default value, remove state.
                else removeState(segIndex, fieldName);
            } else addState(segIndex, fieldName, value);
        }
    }
}

function updateSliderLabelStyle(label) {
    if (label.firstElementChild.checked)
        label.classList.add("active");
    else
        label.classList.remove("active");
}

function isSliderLabelActive(label) {
    return label.classList.contains("active")
}

// This function restores the status of the HTML controls from our bookkeeping.
function loadInputState(segIndex) {
    // We just go over the fields of the given segment, if they exist.
    if (!formState.hasOwnProperty(segIndex)) return;

    for (var fieldName in formState[segIndex]) {
        var tagInfo = extractName(fieldName);
        var type = tagInfo[0];
        if ((type == "inputline") || (type == "inputmulti")) {
            document.getElementsByName(fieldName)[0].value = formState[segIndex][fieldName];
        } else if (type == "checkbox") {
            var checks = formState[segIndex][fieldName];
            for (var i = 0; i < checks.length; i++) {
                document.getElementsByName(fieldName + "_" + checks[i])[0].checked = 1;
            }
        } else if (type == "multi") {
            var element = document.getElementsByName(fieldName)[formState[segIndex][fieldName]];
            element.checked = 1;
            updateSliderLabelStyle(element.parentNode);
        } else if (type == "dropdown") {
            document.getElementsByName(fieldName)[0].selectedIndex = formState[segIndex][fieldName];
        }
    }
}

function focusOnRequiredField(fieldName) {
    // BUGBUG
    // --------------
    // this should take the user to the required field and tell the user it should be filled in.
    // e.g. By adding a red mark and a red text saying "this field is required" from formMeta.requiredText.
    // Required to insert the sentence below the field's segment.
    // *****MAYBE REQUIRES A NEW DIV for this*******
    // Change segment CSS to 'required'...

    return;
}

// Scans to see whether all required fields are filled.
// Otherwise lets the user know she needs to fill it in.
// Stops upon the first input field that isn't filled in.
// If all's good then true is returned, otherwise false.
function enforceInput(segIndex) {
    for (var i = 0; i < segmentFields.length; i++) {
        var fieldInfo = segmentFields[i];
        var fieldName = fieldInfo[0];
        var isRequired = fieldInfo[3];
        var maxOptions = fieldInfo[2];

        if (!isRequired) continue; // Skip unrequired fields.

        var tagInfo = extractName(fieldName);
        var type = tagInfo[0];
        var eIndex = tagInfo[2];

        var found = formState.hasOwnProperty(segIndex) && formState[segIndex].hasOwnProperty(fieldName);
        if (found) {
            // For multi-choice we have to make sure the 'other' input is not empty if exists and chosen.
            if ((type == "multi") && (maxOptions == formState[segIndex][fieldName])) {
                // Calculate the correct name of the 'other' input text field.
                var textOtherName = generateName({
                    "type": "inputline"
                }, segIndex, eIndex + "_other");
                // If it exists it means its length is necessarily positive.
                found = formState[segIndex].hasOwnProperty(textOtherName);
            }
        }

        // If we didn't find an input for the required field, we can fail now.
        if (!found) {
            console.log("Input is required for " + fieldName); // TODO: REMOVE ME
            focusOnRequiredField(fieldName);
            return false;
        }
    }

    // All fields are good.
    return true;
}

function submitForm() {
    // HTTP POST request with user's input.
    var http = new XMLHttpRequest();
    http.open("POST", formMeta.postURL, true);
    http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    var params = "blob=" + JSON.stringify(formState);
    http.send(params);
    //http.onload = function() { alert(http.responseText); }

    // Show thank you message.
    document.getElementById("main").innerHTML = formMeta.actionThanksText;
    // Let the user close page without a warning.
    window.onbeforeunload = null;
}

// Add an entry to the history of navigation.
function updateHistory(index, shouldReplace) {
    if (window.history) {
        var context = {"index":index};
        if (shouldReplace) {
            history.replaceState(context, "", `?id=${index}`);
            document.title = getSegmentTitle(index);
        }
        else {
            history.pushState(context, "", `?id=${index}`);
            document.title = getSegmentTitle(index);
            
        }
        return true;
    }
    return false;
}

// popStateEvent callback.
function loadFromHistory(event) {
    if (event != null) {
        showSegment(event.state.index);
    }
}

function doAction(action, index) {
    // Have to check all required fields are filled, else re-focus user and show error.
    // Do it after step 1 as we will be using the currently stored input state.
    // Always let going backwards, so enforce on forward.
    if ((action == "next") && !enforceInput(index)) {
        // Don't continue if not all fields are filled.
        return;
    }

    if (action == "submit") {
        submitForm();
    } else if (action == "next") {
        
        // Keep track of our own last visited segment.
        // This is important to keep the browser's own 'back' and 'forward' buttons in sync with ours.
        // If we've never been to the next segment, then add it to history and show it.
        if (index + 1 > lastVisitedSegment) {
            lastVisitedSegment = index + 1;
            
            // Add history state.
            updateHistory(index + 1, false);
            // Now show new segment.
            showSegment(index + 1);
        } else {
            // In case we have visited this segment in the past, use the history to go there.
            history.go(1);
        }
    } else if (action == "back") {
        // We can always go backwards.
        history.go(-1);
        // In case backwards didn't work for some reason, show the segment anyway.
        showSegment(index - 1);
    }
}

function handleButtons(index) {
    var output = `<div class='bottom-buttons text-center' role='group'>`;

    // First page has only one button: start.
    if (index == 0) {
        output += `<button class='btn btn-primary' onclick='doAction("next", 0);'>${formMeta.actionStartText}</button>`;
    } else {
        // All other pages always have: back.
        output += `<button class='btn btn-primary' onclick='doAction("back", ${index})'>${formMeta.actionBackText}</button>`;

        // Last page has button: submit.
        if (index == formJSON.segments.length - 1) {
            output += `<button class='btn btn-primary' onclick='doAction("submit", 0)'>${formMeta.actionSubmitText}</button>`;
        } else {
            // Any other page: next.
            output += `<button class='btn btn-primary' onclick='doAction("next", ${index})'>${formMeta.actionNextText}</button>`;
        }
    }

    return output + `</div>`;
}

// This is an onclick handler for the label "other" choice in multi or checkbox fields.
function onOtherLabelClicked(self, pairedElementName) {
    // Only when checking-on the label then transfer focus to corresponding input field.
    // And only in case it has the focus, otherwise we came from another text field and no need to re-select text.
    if (self.checked && (document.activeElement == self)) {
        document.getElementsByName(pairedElementName)[0].focus();
        document.getElementsByName(pairedElementName)[0].select();
    }
    
    // Save state for self control element.
    saveControlState(self);
}

// This is the onclick handler for the "other" input text field.
function onOtherInputClicked(self, pairedElement) {
    if (typeof pairedElement == "string") {
        pairedElement = document.getElementsByName(pairedElement)[0];
    }

    // Only if the checkbox or radio isn't checked then simulate a click
    // (so the relevant handler is called too).
    if (!pairedElement.checked) {
        pairedElement.click();
    }

    // Save state for self control element.
    saveControlState(self);
}

function handleElement(element, segIndex, eIndex) {
    var i;
    var output = "";
    var max = 0;

    // Generate a unique name for the newly created field with indicators of its type and position.
    var name = generateName(element, segIndex, eIndex);

    if (element.type == "inputmultiline") {
        output += "<textarea rows=10 cols=50% name='" + name + "' oninput='saveControlState(this)'></textarea>";
    } else if (element.type == "inputline") {
        output += "<input type='text' oninput='saveControlState(this)' name='" + name + "'>";
    } else if (element.type == "multi") {
        max = element.options.length;
        for (i = 0; i < max; i++) {
            output += "<label><input type='radio' onclick='saveControlState(this)' name='" + name + "' value='" + i + "'>" + element.options[i] + "</label>";
            output += "<br>";
        }
        if (element.hasOwnProperty("other") && (element.other == 1)) {
            // Add a text-input field that auto selects the corresponding radio button automatically upon entering input.
            textName = generateName({
                "type": "inputline"
            }, segIndex, eIndex + "_other");
            // Add feature that focuses & selects the other input field when selecting its radio.
            output += "<label><input type='radio' name='" + name + "' value='" + max + "' onchange='onOtherLabelClicked(this, \"" + textName + "\")'>" + formMeta.otherText + "</label>";
            output += "<input type='text' name='" + textName + "' oninput='onOtherInputClicked(this, document.getElementsByName(\"" + name + "\")[" + max + "])'>";
            output += "<br>"; // REMOVE ME

            // Add the new 'other' element to the list.
            addField(textName, segIndex, 0, 0);
        }
    } else if (element.type == "dropdown") {
        output += "<select onchange='saveControlState(this)' name='" + name + "'>";
        output += "<option name='" + name + "' value='0' >" + formMeta.chooseText + "</option>";
        max = element.options.length;
        for (i = 0; i < max; i++) {
            output += "<option name='" + name + "' value=" + (i + 1) + ">" + element.options[i] + "</option>";
        }
        output += "</select>";
    } else if (element.type == "checkbox") {
        max = element.options.length;
        for (i = 0; i < max; i++) {
            output += "<label><input type='checkbox' onclick='saveControlState(this)' name='" + name + "_" + i + "' value='" + i + "'>" + element.options[i] + "</label>";
        }
        if (element.hasOwnProperty("other") && (element.other == 1)) {
            // Add a text-input field that auto selects the corresponding check-box automatically upon entering input.
            textName = generateName({
                "type": "inputline"
            }, segIndex, eIndex + "_other");
            var maxName =  name + "_" + max;
            // Add feature that focuses & selects the other input field when clicking on its check-box.
            output += "<label><input type='checkbox' name='" + maxName + "' value='" + max + "' onclick='onOtherLabelClicked(this, \"" + textName + "\")'>" + formMeta.otherText + "</label>";
            output += "<input type='text' name='" + textName + "' oninput='onOtherInputClicked(this, \"" + maxName + "\")'>";
            output += "<br>"; // REMOVE ME

            // Add the new 'other' element to the list.
            addField(textName, segIndex, 0, 0);
        }
    } else throw ("Unsupported element type!");

    // TODO: consider adding a div for "required-field error".

    // Add the new element to the list.
    var isRequired = (element.hasOwnProperty("required") && (element.required == 1));
    if (!isRequired) max = -1; // Ignore max options if it's not a required field.
    addField(name, segIndex, max, isRequired);

    return output;
}

function handleElements(seg, segIndex) {
    var i;
    var output = "";
    for (i = 0; i < seg.elements.length; i++) {
        // Begin segment div.
        output += "<div class='segment'>";

        output += "<h3>" + seg.elements[i].text + "</h3>";
        output += handleElement(seg.elements[i], segIndex, i);

        // End segment div.
        output += "</div>";
    }
    return output;
}


function onSliderInputClicked(input) {
    label = input.parentNode;
    input.checked = !isSliderLabelActive(label);
    updateSliderLabelStyle(label);

    for (var other of label.parentNode.children) {
        if (other === label ||
            !other.firstElementChild)
            continue;

        other.firstElementChild.checked = false;
        updateSliderLabelStyle(other);
    };

    saveControlState(input);
}

function onCommentsInput(comments) {
    comments.style.height = 'auto';
    comments.style.height = (comments.scrollHeight) + 'px';

    saveControlState(comments);
}

function handleQuestions(seg, segIndex) {
    // TODO: subQuestions don't support 'required' at the moment.

    var i;
    var output = "";

    // Open question group div.
    output += `
        <div class='question-group'>
    `;

    for (i = 0; i < seg.subQuestions.length; i++) {
        // Open question div,
        // Add question text,
        // Open centering div.
        // Open slider div.
        output += `
            <div class='question'>
            <p class='question-text'>${seg.subQuestions[i]}</p>
            <div class='text-center'>
            <div class='question-slider btn-group btn-group-toggle'>
        `;

        // "slide":[MIN, MAX, NOTEXT, YESTEXT]
        max = seg.slide[1];
        var name = generateName({
            "type": "multi"
        }, segIndex, i);
        
        // Add minimum label.
        output += `
            <div class='btn btn-secondary disabled'>${seg.slide[3]}</div>
        `;
        
        // Add digits.
        for (var j = seg.slide[0]; j <= max; j++) {
            output += `
                <label class="btn btn-secondary">
                    <input type='radio' name='${name}' value='${j - seg.slide[0]}' onclick='${onSliderInputClicked.name}(this)'>${j}
                </label>
            `;
        }
        
        // Add maximum label.
        output += `
            <div class='btn btn-secondary disabled'>${seg.slide[2]}</div>
        `;

        // Close slider div,
        // Close centering div.
        // close question div.
        output += `
            </div>
            </div>
            </div>
        `;

        addField(name, segIndex, max, 0);
    }

    // Close question group div.
    output += `
        </div>
    `;

    if (seg.comments) {
        var name = generateName({
            "type": "inputmulti"
        }, segIndex, 0);

        output += `
            <textarea class='textarea-autosize'
                      rows=1
                      name='${name}'
                      oninput='${onCommentsInput.name}(this)'
                      placeholder='${formMeta.commentsText}'></textarea>
        `;

        addField(name, segIndex, 0, 0);
    }

    return output;
}

// Returns the correct displayable question # by skipping elements that aren't "questions" type.
function getQuestionNum(index) {
    var i;
    var count = 1;
    for (i = 0; i < index; i++) {
        if (formJSON.segments[i].type == "questions") count++;
    }
    return count;
}

// Find the correct title for the given segment.
function getSegmentTitle(index) {
    var seg = formJSON.segments[index];
    if (seg.type == "segment") {
        if (seg.hasOwnProperty("title")) {
            return seg.title;
        }
    } else if (seg.type == "questions") {
        return formMeta.questionText + " " + getQuestionNum(index);
    }

    // Shouldn't reach here.
    return "";
}

// This function is the engine.
function showSegment(index) {
    // HTML to output.
    var output = "";

    // Reset segmentFields list as we're changing segment.
    resetFields();

    var seg = formJSON.segments[index];

    // Add progress bar for non-title pages.
    if (index > 0) {
        var total_segments = formJSON.segments.length;
        var progress = Math.round(index / total_segments * 100);
    
        output += `
            <div class="progress">
            <div class="progress-bar"
                 role="progressbar"
                 style="width: ${progress}%"
                 aria-valuenow="${index}"
                 aria-valuemin="1"
                 aria-valuemax="${total_segments}">${index}/${total_segments}</div>
            </div>
        `;
    }

    if (seg.hasOwnProperty("title")) {
        output += `
            <h1>${seg.title}</h1>
        `;
    }

    if (seg.hasOwnProperty("text")) {
        output += "<p>" + _formatText(seg.text) + "</p>";
    }

    if (seg.hasOwnProperty("elements")) {
        output += handleElements(seg, index);
    } else if (seg.hasOwnProperty("subQuestions")) {
        output += handleQuestions(seg, index);
    } else throw ("Bad segment type!");

    output += handleButtons(index);
    document.getElementById("main").innerHTML = output;

    // Only after the new elements are presented, we can set their state if existing.
    loadInputState(index);
}

function getFormDataUrl() {
    var dataElements = document.getElementsByTagName("qform-data");
    if (dataElements.length != 1)
        throw Error("Unexpected number of qform-data elements");

    return dataElements[0].attributes['src'].value;
}

document.addEventListener('DOMContentLoaded', function () {
    // Find user's JSON base path;
    var basePath = getFormDataUrl();

    // Load the meta data first.
    var metaPath = basePath + "meta.json";
    var ajax = new XMLHttpRequest();
    ajax.onload = function () {
        formMeta = JSON.parse(ajax.responseText);

        if (formMeta.hasOwnProperty("dir")) {
            document.body.style.direction = formMeta.dir;
        }

        if (formMeta.reloadWarning == 1) {
            document.body.onbeforeunload = function () {
                return "Are you sure you want to reload and lose information?";
            };
        }
        
        // Support history navigation.
        window.addEventListener('popstate', loadFromHistory);

        // Now load the actual questions data.
        var ajaxForm = new XMLHttpRequest();
        ajaxForm.onload = function () {
            formJSON = JSON.parse(ajaxForm.responseText);

            submissionObj = {};
            submissionObj["type"] = "segment";
            submissionObj["text"] = formMeta.submissionText;
            submissionObj["elements"] = [];
            formJSON.segments.push(submissionObj);

            // Initialize our history here on first visit.
            updateHistory(0, true);

            // This boots the whole UI!
            showSegment(0);
        };
        var jsonPath = basePath + ".json";
        ajaxForm.open("GET", jsonPath, true);
        ajaxForm.send(null);
    };
    ajax.open("GET", metaPath);
    ajax.send(null);
});
