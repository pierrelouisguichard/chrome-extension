document.getElementById("logName").addEventListener("click", async () => {
  const status = document.getElementById("status");

  // Clear previous status message
  status.innerText = "";

  // Query the active tab in the current window.
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (chrome.runtime.lastError) {
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
      async (response) => {
        // Make this function async
        if (chrome.runtime.lastError) {
          status.innerText = `Error sending message: ${chrome.runtime.lastError.message}`;
          return;
        }

        if (response && response.name) {
          try {
            console.log("Received response:", response); // Debugging log

            // Await the VCF content
            const vcfContent = await createVcf(
              tabs[0],
              response.name.trim(),
              response.profilePicUrl,
              response.description,
              response.experienceDetails,
              response.educationDetails
            );

            console.log("Generated VCF content:", vcfContent); // Debugging log

            // Create a Blob from the VCF content and generate a download link.
            const blob = new Blob([vcfContent], { type: "text/vcard" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${response.name.trim()}.vcf`;
            document.body.appendChild(a);
            a.click(); // Trigger the download.

            // Clean up
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            status.innerText = `Downloaded: ${response.name}.vcf`;
          } catch (error) {
            status.innerText = `Error generating VCF: ${error.message}`;
          }
        } else {
          console.log("------------ERROR--------------");
          console.log(response);
          console.log(response?.name);
          console.log("------------END--------------");
          status.innerText = "Name or Profile Picture not found!";
        }
      }
    );
  });
});

function splitFullName(fullName) {
  // Trim any extra spaces from the full name
  fullName = fullName.trim();

  // Split the full name by spaces
  const nameParts = fullName.split(" ");

  // Handle different cases based on the number of parts in the name
  const result = {
    firstName: "",
    lastName: "",
  };

  if (nameParts.length === 1) {
    // If there's only one part, it's considered the first name
    result.firstName = nameParts[0];
  } else if (nameParts.length > 1) {
    // If there are two or more parts, use the first and last parts as first name and last name
    result.firstName = nameParts[0];
    result.lastName = nameParts[nameParts.length - 1];
  }

  return result;
}

async function getBase64Image(url) {
  const response = await fetch(url);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      const base64data = reader.result.split(",")[1]; // Remove 'data:image/png;base64,'
      resolve(base64data);
    };
    reader.onerror = reject;
  });
}

async function createVcf(
  tab,
  name,
  profilePicUrl,
  description,
  experience,
  education
) {
  const tabUrl = tab.url || "";
  let vcfContent = `BEGIN:VCARD\nVERSION:3.0\n`;

  vcfContent += `FN:${name}\n`;
  const arrFullName = splitFullName(name);
  vcfContent += `N:${arrFullName.lastName};${arrFullName.firstName};;;\n`;

  // Convert the profile picture to Base64
  if (profilePicUrl) {
    try {
      const base64Photo = await getBase64Image(profilePicUrl);
      vcfContent += `PHOTO;ENCODING=b;TYPE=JPEG:${base64Photo}\n`;
    } catch (error) {
      console.error("Error fetching profile picture:", error);
    }
  }

  let org = "",
    title = "";

  if (
    Array.isArray(experience) &&
    experience.length > 0 &&
    Array.isArray(experience[0])
  ) {
    let firstExperience = experience[0];

    if (firstExperience[1] && isNaN(firstExperience[1].charAt(0))) {
      org = firstExperience[1] || "";
      title = firstExperience[0] || "";
    } else {
      org = firstExperience[0] || "";
      title = firstExperience[2] || "";
    }

    const char = String.fromCodePoint(183);
    const index = org.indexOf(char) - 1;

    if (index > -1) {
      org = org.substring(0, index).trim();
    }
  }

  if (org) vcfContent += `ORG:${org}\n`;
  if (title) vcfContent += `TITLE:${title}\n`;

  let noteContent = " -------- ABOUT -------- \n" + (description || "");
  function formatList(list) {
    if (!Array.isArray(list) || !list.length || !Array.isArray(list[0]))
      return "";
    return list.map((subList) => subList.join("\n")).join("\n\n");
  }

  if (experience || education) {
    noteContent +=
      "\n\n -------- EXPERIENCE -------- \n" +
      formatList(experience) +
      "\n\n" +
      " -------- EDUCATION -------- \n" +
      formatList(education);
  }

  if (noteContent) {
    vcfContent += `NOTE:${noteContent.replace(/\n/g, "\\n")}\n`;
  }

  vcfContent += `URL:${tabUrl}\nEND:VCARD`;

  return vcfContent;
}
