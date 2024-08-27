/**
 * Processes the experience section of the profile.
 * @returns {Array<string>} An array of text content from the experience section.
 */
function processExperienceSection() {
  return processSection("div#experience", "experience");
}

/**
 * Processes the education section of the profile.
 * @returns {Array<string>} An array of text content from the education section.
 */
function processEducationSection() {
  return processSection("div#education", "education");
}

/**
 * Processes the licenses and certifications section of the profile.
 * @returns {Array<string>} An array of text content from the licenses and certifications section.
 */
function processLicensesAndCertificationsSection() {
  return processSection(
    "div#licenses_and_certifications",
    "licenses_and_certifications"
  );
}

/**
 * General function to process a section of the profile.
 * @param {string} divSelector - The CSS selector for the section's container.
 * @param {string} sectionName - The name of the section.
 * @returns {Array<string>} An array of text content from the section.
 */
function processSection(divSelector, sectionName) {
  const sectionDiv = document.querySelector(divSelector);

  if (!sectionDiv) {
    return []; // No section found
  }

  const parentSection = sectionDiv.closest("section");

  if (!parentSection) {
    return []; // No parent section found
  }

  const listItems = parentSection.querySelectorAll("li.artdeco-list__item");
  const itemsToProcess = Array.from(listItems).slice(0, 4); // Limit to first 4 items
  const results = [];

  itemsToProcess.forEach((item) => {
    const text = extractTextFromListItem(item);
    if (text) results.push(text); // Collect non-empty text
  });

  return results;
}

/**
 * Extracts text from a list item, skipping certain phrases and alternating entries.
 * @param {Element} listItem - The list item element to process.
 * @returns {Array<string>} An array of text content from the list item.
 */
function extractTextFromListItem(listItem) {
  let logCounter = 0;
  const results = [];

  /**
   * Determines if the text should be logged based on excluded phrases.
   * @param {string} text - The text to check.
   * @returns {boolean} True if the text should be logged.
   */
  function isLoggableText(text) {
    const excludedPhrases = ["show all", "see more"];
    return !excludedPhrases.some((phrase) =>
      text.toLowerCase().includes(phrase)
    );
  }

  /**
   * Recursively processes child nodes to extract text.
   * @param {Node} node - The node to process.
   */
  function processChildNodes(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      let textContent = node.textContent.trim();
      if (textContent && isLoggableText(textContent)) {
        if (logCounter % 2 === 1) {
          results.push(textContent); // Alternate text entries
        }
        logCounter++;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      for (let child of node.childNodes) {
        processChildNodes(child);
      }
    }
  }

  processChildNodes(listItem);

  return results;
}

/**
 * Retrieves profile details from the page.
 * @returns {Object} An object containing the profile details.
 */
function getProfileDetails() {
  const nameElement = document.querySelector(".text-heading-xlarge");
  const profilePicElement = document.querySelector(
    ".pv-top-card-profile-picture__image--show"
  );
  const descriptionElement = document.querySelector(
    "div.text-body-medium.break-words"
  );
  const experienceDetails = processExperienceSection();
  const educationDetails = processEducationSection();
  const licensesAndCertificationsDetails =
    processLicensesAndCertificationsSection();

  const name = nameElement ? nameElement.textContent.trim() : null;
  const profilePicUrl = profilePicElement ? profilePicElement.src : null;
  const description = descriptionElement
    ? descriptionElement.textContent.trim()
    : null;

  return {
    name,
    profilePicUrl,
    experienceDetails,
    educationDetails,
    licensesAndCertificationsDetails,
    description,
  };
}

// Listens for messages from the extension background script and sends profile details in response.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getProfileDetails") {
    const details = getProfileDetails();
    sendResponse(details);
  }
});
