document.getElementById("logName").addEventListener("click", () => {
  const status = document.getElementById("status");

  // Clear previous status message
  status.innerText = "";

  // Query the active tab in the current window.
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (chrome.runtime.lastError) {
      // Handle errors from chrome.tabs.query
      status.innerText = `Error querying tabs: ${chrome.runtime.lastError.message}`;
      return;
    }

    if (!tabs[0]) {
      status.innerText = "No active tab found!";
      return;
    }

    // Send a message to the content script in the active tab to get profile details.
    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: "getProfileDetails" },
      (response) => {
        if (chrome.runtime.lastError) {
          // Handle errors from chrome.tabs.sendMessage
          status.innerText = `Error sending message: ${chrome.runtime.lastError.message}`;
          return;
        }

        if (response && response.name) {
          try {
            // Create VCF content from the response data.
            const vcfContent = createVcf(
              response.name.trim(),
              response.profilePicUrl,
              response.description,
              response.experienceDetails,
              response.educationDetails,
              response.licensesAndCertificationsDetails
            );

            // Create a Blob from the VCF content and generate a download link.
            const blob = new Blob([vcfContent], { type: "text/vcard" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${response.name.trim()}.vcf`;
            document.body.appendChild(a);
            a.click(); // Trigger the download.

            // Clean up by removing the link and revoking the object URL.
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            status.innerText = `Downloaded: ${response.name}.vcf`;
          } catch (error) {
            // Handle errors that occur during VCF content creation or download
            status.innerText = `Error generating VCF: ${error.message}`;
          }
        } else {
          status.innerText = "Name or Profile Picture not found!";
        }
      }
    );
  });
});

/**
 * Creates a VCF (vCard) content string from the provided profile data.
 * @param {string} name - The name of the person.
 * @param {string} profilePicUrl - The URL of the profile picture.
 * @param {string} description - A description or note about the person.
 * @param {Array<Array<string>>} experience - List of experiences.
 * @param {Array<Array<string>>} education - List of educational qualifications.
 * @param {Array<Array<string>>} licenses - List of licenses and certifications.
 * @returns {string} The generated VCF content.
 */
function createVcf(
  name,
  profilePicUrl,
  description,
  experience,
  education,
  licenses
) {
  let vcfContent = `BEGIN:VCARD\nVERSION:3.0\n`;

  vcfContent += `FN:${name}\n`;

  if (profilePicUrl) {
    vcfContent += `PHOTO;VALUE=URI:${profilePicUrl}\n`;
  }

  let org = "";
  let title = "";

  // Extract the first experience item to set organization and title.
  if (
    Array.isArray(experience) &&
    experience.length > 0 &&
    Array.isArray(experience[0])
  ) {
    let firstExperience = experience[0];
    org = firstExperience[0] || "";

    if (firstExperience[1] && isNaN(firstExperience[1].charAt(0))) {
      title = firstExperience[1];
    } else {
      title = firstExperience[2] || "";
    }

    const char = String.fromCodePoint(183);
    const index = title.indexOf(char) - 1;

    if (index > -1) {
      title = title.substring(0, index).trim();
    }
  }

  if (org) {
    vcfContent += `ORG:${org}\n`;
  }
  if (title) {
    vcfContent += `TITLE:${title}\n`;
  }

  let noteContent = " -------- ABOUT: -------- \n" + (description || "");

  /**
   * Formats a list of items into a string suitable for VCF NOTE fields.
   * @param {Array<Array<string>>} list - List of lists containing text items.
   * @returns {string} The formatted list as a string.
   */
  function formatList(list) {
    if (!Array.isArray(list) || !list.length || !Array.isArray(list[0])) {
      return "";
    }

    return list
      .map((subList) => {
        return subList.map((item) => `${item}`).join("\n");
      })
      .join("\n\n");
  }

  // Append experience, education, and licenses to the note content if they exist.
  if (experience || education || licenses) {
    noteContent +=
      "\n\n" +
      " -------- EXPERIENCE: -------- \n" +
      formatList(experience) +
      "\n\n" +
      " -------- EDUCATION: -------- \n" +
      formatList(education) +
      "\n\n" +
      " -------- LICENSES & CERTIFICATION: -------- \n" +
      formatList(licenses);
  }

  if (noteContent) {
    noteContent = noteContent.replace(/\n/g, "\\n");
    vcfContent += `NOTE:${noteContent}\n`;
  }

  vcfContent += `END:VCARD`;

  return vcfContent;
}
