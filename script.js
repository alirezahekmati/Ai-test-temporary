// --- DOM Elements ---
const apiKeyInput = document.getElementById("api-key-input");
const submitApiKeyButton = document.getElementById("submit-api-key");
const statusMessage = document.getElementById("status-message");
const chatInterface = document.getElementById("chat-interface");
const chatLog = document.getElementById("chat-log");
const experimentInput = document.getElementById("experiment-input");
const sendButton = document.getElementById("send-button");
const loadingIndicator = document.getElementById("loading-indicator");

// --- Configuration ---
const modelName = "gemini-2.5-flash-preview-04-17"; // Using flash model as requested
const API_ENDPOINT_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models/";

// --- State Variables ---
let apiKey = null;
let labEquipmentsData = null;
let labOutData = null;
let isDataLoaded = false;
let isKeySet = false;

// --- Project Synapse Instructions (Same as before) ---
const synapseInstructions = `
Project Synapse: AI Experimental Protocol Generator
CONTEXT
You are "Project Synapse," an AI assistant that helps researchers plan experiments by generating detailed protocols. You have access to two datasets provided below:
1.  Lab_equipments.json: Contains all equipment available in our lab.
2.  lab_out.json: Contains equipment available at other institutions.

YOUR TASK
When I describe an experiment, analyze my description and the provided JSON data to generate a comprehensive protocol that includes all necessary equipment, materials, and procedures. The goal is to determine if we can perform the experiment with our available equipment, and if not, identify what we need to source from other institutions based ONLY on the provided JSON data.

PROCESS
1️⃣ ANALYZE THE EXPERIMENT
•   [ ] Read the experiment description thoroughly
•   [ ] Identify the main objectives and methods
•   [ ] Determine the key experimental steps
2️⃣ IDENTIFY REQUIRED EQUIPMENT & MATERIALS
•   [ ] List all equipment directly mentioned in the description
•   [ ] Identify additional equipment that would be necessary but might not be explicitly mentioned (based on common lab practices for the described experiment)
•   [ ] Consider control measures and equipment needed for these
•   [ ] Consider measurement and monitoring equipment
•   [ ] Identify safety equipment requirements
•   [ ] List all consumables, chemicals, and reagents needed
3️⃣ CHECK AVAILABILITY IN YOUR LAB (Using Lab_equipments.json data)
•   [ ] For each equipment item, check if it exists in Lab_equipments.json. Search primarily by Equipment_Name, considering Model and Specs for specificity if needed.
•   [ ] Verify the condition and availability status ('Available' field MUST be 'Yes'). Check 'Condition' isn't 'Fair' or 'Repair' if critical. Note the quantity.
•   [ ] For available equipment, note location and relevant specifications.
•   [ ] Identify any equipment that's unavailable (Not listed, Available != 'Yes', insufficient Quantity, poor Condition).
4️⃣ CHECK EXTERNAL AVAILABILITY (Using lab_out.json data)
•   [ ] For equipment not available in your lab, check lab_out.json. Search primarily by Equipment_Name, considering Specs.
•   [ ] Prioritize by distance (Distance_km), access level (Access_Level - prefer Open/Request), and specifications.
•   [ ] Note contact information (Contact_Email) for arranging access.
•   [ ] Identify any essential equipment not found in either database.
5️⃣ GENERATE PROTOCOL
•   [ ] Create step-by-step instructions with clear numbering.
•   [ ] Specify equipment used at each step (mentioning source: 'Our Lab' or External Institution Name).
•   [ ] Include detailed parameters (temperature, time, concentrations, volumes, etc.).
•   [ ] Include safety precautions relevant to the step/materials.
•   [ ] Add quality control checks where appropriate.
•   [ ] Include cleaning and sterilization procedures if relevant.
•   [ ] Add waste disposal instructions for hazardous materials.

DETAILED EQUIPMENT & MATERIALS CHECKLIST (Ensure your generated protocol considers these)
Equipment Categories: Core experimental, Measurement/monitoring, Safety (PPE, hoods, etc.), Sample prep, Storage (fridge, freezer, -80), Sterilization (autoclave, UV), Analytical instruments.
Consumables: Chemicals, reagents, disposables (pipette tips, tubes, plates), Cleaning supplies.
Special Considerations: Temperature control, Sterility requirements, Hazardous materials handling, Waste disposal needs, Data acquisition/analysis.

OUTPUT FORMAT
Present your response with the following structure:
🔬 PROTOCOL SUMMARY
Brief overview of the experiment and its objectives.
📋 EQUIPMENT & MATERIALS AVAILABILITY
✅ Available in Our Lab:
•   Equipment Name (Location, Model, Condition) - Qty: [Quantity]
•   ...
🔄 Unavailable/Insufficient in Our Lab (Available Externally):
•   Equipment Name (Institution, Department, Access Level, Distance_km)
•   Contact: [Contact_Email]
•   Reason Unavailable Here: [e.g., Not found, Maintenance, Repair, Condition=Fair, Insufficient Quantity]
•   ...
❓ Unavailable/Insufficient in Our Lab (Not Found Externally):
•   Equipment Name
•   Reason Unavailable Here: [e.g., Not found, Maintenance, Repair, Condition=Fair, Insufficient Quantity]
•   ...
🧪 Consumables & Reagents Needed:
•   [List of chemicals, reagents, buffers, media, disposables etc.]
•   ...
📝 DETAILED PROTOCOL
1.  **Step Title (e.g., Sample Preparation)**
    a. Sub-step description...
    o   *Equipment:* [Equipment Name (Source)]
    o   *Parameters:* [Specific settings, volumes, concentrations]
    o   *Duration:* [Estimated time]
    o   *Safety Note:* [If applicable]
2.  **Step Title (e.g., Incubation)**
    a. ...
⚠️ SAFETY CONSIDERATIONS
•   **Required PPE:** [List specific PPE, e.g., Lab coat, safety glasses, nitrile gloves, face shield]
•   **General Hazards:** [e.g., Chemical exposure (list specific chemicals), Electrical, Thermal]
•   **Emergency Procedures:** [e.g., Location of eyewash/shower, spill kit usage]
•   **Waste Disposal:** [Specific instructions for chemical/biological waste]
📌 ADDITIONAL NOTES
[Any other important considerations, e.g., calibration reminders, critical timings, data storage location]

--- START OF JSON DATA ---
`; // Instructions end here, JSON data will be appended

// --- Helper Functions ---

function showStatus(message, type = "info") {
  // types: info, success, error, loading
  statusMessage.textContent = message;
  statusMessage.className = `status-${type}`;
}

function addMessageToChatLog(message, sender) {
  const messageElement = document.createElement("p");
  const senderStrong = document.createElement("strong");
  senderStrong.textContent = `${sender}:`;

  messageElement.appendChild(senderStrong);

  // Basic Markdown to HTML conversion
  let formattedMessage = message
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // Bold
    .replace(/\*(.*?)\*/g, "<em>$1</em>") // Italics
    .replace(
      /```([\s\S]*?)```/g,
      (match, p1) => `<pre>${p1.replace(/</g, "<").replace(/>/g, ">")}</pre>`
    ) // Code blocks (escape html inside)
    .replace(
      /`([^`]+)`/g,
      (match, p1) => `<code>${p1.replace(/</g, "<").replace(/>/g, ">")}</code>`
    ) // Inline code (escape html inside)
    .replace(/\n/g, "<br>"); // Line breaks

  const contentSpan = document.createElement("span");
  contentSpan.innerHTML = " " + formattedMessage; // Add space after sender
  messageElement.appendChild(contentSpan);

  // Add class based on sender for styling
  if (sender === "You") {
    messageElement.classList.add("user-message");
  } else if (sender === "Synapse") {
    messageElement.classList.add("ai-message");
  } else {
    messageElement.classList.add("system-message");
  }

  chatLog.appendChild(messageElement);
  chatLog.scrollTop = chatLog.scrollHeight; // Auto-scroll to bottom
}

function setInteractionState(enabled) {
  experimentInput.disabled = !enabled;
  sendButton.disabled = !enabled;
  // Add ready message only once after successful setup
  if (
    enabled &&
    chatLog.querySelectorAll(".ai-message, .user-message").length === 0
  ) {
    addMessageToChatLog(
      "Ready! Describe the experiment you want to plan.",
      "Synapse"
    );
  }
}

// --- Core Logic ---

async function loadJsonData() {
  try {
    const response1 = await fetch("Lab_equipments.json");
    if (!response1.ok)
      throw new Error(
        `Failed to load Lab_equipments.json: ${response1.status} ${response1.statusText}`
      );
    labEquipmentsData = await response1.json();

    const response2 = await fetch("lab_out.json");
    if (!response2.ok)
      throw new Error(
        `Failed to load lab_out.json: ${response2.status} ${response2.statusText}`
      );
    labOutData = await response2.json();

    console.log("JSON data loaded successfully.");
    isDataLoaded = true;
    return true; // Indicate success
  } catch (error) {
    console.error("Error loading JSON data:", error);
    showStatus(`Error loading equipment data: ${error.message}`, "error");
    addMessageToChatLog(
      `Critical Error: Could not load equipment data (${error.message}). Please check the JSON files and refresh.`,
      "System"
    );
    isDataLoaded = false;
    return false; // Indicate failure
  }
}

function validateApiKeyFormat(key) {
  // Basic check - just ensure it's not obviously empty or whitespace.
  // Real validation happens server-side.
  return key && key.trim().length > 10;
}

async function handleApiKeySubmit() {
  submitApiKeyButton.disabled = true;
  apiKeyInput.disabled = true;
  showStatus("Setting API Key and loading data...", "loading");

  apiKey = apiKeyInput.value.trim();
  if (!validateApiKeyFormat(apiKey)) {
    showStatus("API Key seems too short or empty. Please check.", "error");
    submitApiKeyButton.disabled = false;
    apiKeyInput.disabled = false;
    return;
  }
  isKeySet = true; // Assume key format is okay for now.
  console.log("API Key stored (basic format check passed).");

  const dataLoaded = await loadJsonData();
  if (!dataLoaded) {
    submitApiKeyButton.disabled = false; // Allow retry if key was okay but data failed
    apiKeyInput.disabled = false;
    isKeySet = false; // Reset key status if data fails
    // Status/message already set in loadJsonData
    return;
  }

  // Success!
  showStatus("API Key set and data loaded successfully!", "success");
  document.getElementById("api-key-section").style.display = "none"; // Hide API section
  chatInterface.style.display = "block"; // Show chat section
  setInteractionState(true); // Enable chat input
  experimentInput.focus(); // Focus on the input field
}

async function sendExperimentRequest() {
  const description = experimentInput.value.trim();
  if (!description) return; // Don't send empty messages

  if (!isKeySet || !isDataLoaded) {
    addMessageToChatLog("Error: API Key not set or data not loaded.", "System");
    // Optionally bring back API key input if key isn't set
    if (!isKeySet) {
      document.getElementById("api-key-section").style.display = "block";
      chatInterface.style.display = "none";
      apiKeyInput.disabled = false;
      submitApiKeyButton.disabled = false;
    }
    return;
  }

  addMessageToChatLog(description, "You");
  experimentInput.value = ""; // Clear input field
  setInteractionState(false); // Disable input during processing
  loadingIndicator.style.display = "flex";

  // --- Direct REST API Call using fetch ---
  const fullPrompt = `
${synapseInstructions}

Lab_equipments.json:
${JSON.stringify(labEquipmentsData, null, 2)}

lab_out.json:
${JSON.stringify(labOutData, null, 2)}

--- END OF JSON DATA ---

Now, please analyze the following experiment description and generate the protocol according to the OUTPUT FORMAT specified above:

Experiment Description: "${description}"
`;

  // Construct the API request body
  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: fullPrompt,
          },
        ],
      },
    ],
    // It's good practice to include safety settings
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE",
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_MEDIUM_AND_ABOVE",
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE",
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE",
      },
    ],
    generationConfig: {
      // temperature: 0.7, // Optional: Adjust creativity
      maxOutputTokens: 8192, // Set a reasonable max limit
    },
  };

  const API_URL = `${API_ENDPOINT_BASE}${modelName}:generateContent?key=${apiKey}`; // Append key as query param

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Using key in URL instead of header based on common practice for this API
      },
      body: JSON.stringify(requestBody),
    });

    const responseData = await response.json(); // Always try to parse JSON, even for errors

    if (!response.ok) {
      // Extract message from Google's error structure if available
      const message =
        responseData?.error?.message ||
        `HTTP error! status: ${response.status} ${response.statusText}`;
      throw new Error(message); // Throw error with detailed message
    }

    // --- Process the successful response ---
    if (!responseData.candidates || responseData.candidates.length === 0) {
      let reason = "No response content received from AI.";
      // Check for prompt feedback block reason
      if (responseData.promptFeedback?.blockReason) {
        reason = `Blocked due to Prompt Feedback: ${responseData.promptFeedback.blockReason}`;
      } else if (responseData.candidates?.[0]?.finishReason === "SAFETY") {
        reason = `Blocked due to Safety Settings. Finish Reason: SAFETY.`;
      }
      throw new Error(reason);
    }

    const candidate = responseData.candidates[0];
    // Check finish reason in the first candidate
    if (
      candidate.finishReason &&
      candidate.finishReason !== "STOP" &&
      candidate.finishReason !== "MAX_TOKENS"
    ) {
      // Handle safety blocks explicitly if possible
      if (candidate.finishReason === "SAFETY") {
        let safetyRatingsInfo = "Safety Ratings: ";
        candidate.safetyRatings?.forEach((rating) => {
          safetyRatingsInfo += `${rating.category}=${rating.probability}; `;
        });
        throw new Error(
          `Generation stopped due to SAFETY. ${safetyRatingsInfo}. Try rephrasing your request.`
        );
      } else {
        throw new Error(
          `Generation stopped unexpectedly. Finish Reason: ${candidate.finishReason}`
        );
      }
    }

    // Extract the text content
    if (
      !candidate.content ||
      !candidate.content.parts ||
      candidate.content.parts.length === 0 ||
      !candidate.content.parts[0].text
    ) {
      // If structure is there but text is missing, maybe MAX_TOKENS was hit right away?
      if (candidate.finishReason === "MAX_TOKENS") {
        throw new Error(
          "Received response structure, but no text content found (MAX_TOKENS reached immediately?)."
        );
      } else {
        throw new Error(
          "Received response structure, but no text content found."
        );
      }
    }

    const text = candidate.content.parts[0].text;
    addMessageToChatLog(text, "Synapse");
  } catch (error) {
    console.error("Error calling Google AI REST API:", error);
    let errorMsg = `Error: ${error.message}`; // Use the detailed error message

    // Check if the error suggests an API key issue
    if (
      error.message &&
      (error.message.includes("API key") ||
        error.message.includes("PERMISSION_DENIED") ||
        error.message.includes("invalid"))
    ) {
      errorMsg +=
        " Please verify your API key and ensure it's enabled for the Generative Language API.";
      // Reset API key state and show input section again
      isKeySet = false;
      apiKey = null;
      document.getElementById("api-key-section").style.display = "block";
      chatInterface.style.display = "none";
      apiKeyInput.disabled = false;
      submitApiKeyButton.disabled = false;
      apiKeyInput.value = "";
      showStatus("API Key validation failed. Please re-enter.", "error");
    } else if (
      error.message &&
      (error.message.includes("quota") ||
        error.message.includes("RESOURCE_EXHAUSTED"))
    ) {
      errorMsg += " You might have exceeded your API usage quota.";
    }
    addMessageToChatLog(errorMsg, "System"); // Display error in chat
  } finally {
    loadingIndicator.style.display = "none";
    // Re-enable interaction only if key is still considered valid and data loaded
    if (isKeySet && isDataLoaded) {
      setInteractionState(true);
    }
    experimentInput.focus(); // Focus back on input for convenience
  }
}

// --- Event Listeners ---
submitApiKeyButton.addEventListener("click", handleApiKeySubmit);
apiKeyInput.addEventListener("keypress", (event) => {
  if (event.key === "Enter") {
    handleApiKeySubmit();
  }
});

sendButton.addEventListener("click", sendExperimentRequest);
experimentInput.addEventListener("keypress", (event) => {
  // Send on Enter, allow Shift+Enter for new line
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault(); // Prevent default Enter behavior (new line)
    sendExperimentRequest();
  }
});

// --- Initial Setup ---
setInteractionState(false); // Initially disable chat
// Optionally clear API key input on load for better security UX
// apiKeyInput.value = "";
