document.addEventListener("DOMContentLoaded", async function () {
  const reportLink = document.getElementById("report-link");
  const dashboard = document.getElementById("dashboard");
  const errorMessage = document.getElementById("error-message");
  const errorMessage2 = document.getElementById("error-message2");
  const settingsButton = document.getElementById("settings");

  const apiUrl = "https://5tkpkldrszif7wej5l6kdqam3u0upiid.lambda-url.eu-west-1.on.aws/";

  // Check if the email is stored in local storage
  chrome.storage.local.get("email", async function (data) {
    if (data.email) {
      const email = data.email; // Extract the email from storage

      try {
        // Call the API with the stored email
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        });

        if (response.ok) {
          const result = await response.json();
          //document.getElementById("apiResponse").textContent = JSON.stringify(result, null, 2);
          if (result.ppa_service === "ppa-advanced") {
            // If email is configured, show the report link and dashboard
            document.getElementById("apiResponse").textContent = "";
            reportLink.style.display = "block";
            dashboard.style.display = "block";
            reportLink.href = result.advancedreport;
            document.getElementById("version").textContent = "(last data upload " + result.healthdata[0].version + ")";

            // guiding numbers
            document.getElementById("posts_per_week").textContent = result.healthdata[0].post_recom;
            document.getElementById("new_followers_day").textContent = result.healthdata[0].newfollowers_recom;
            document.getElementById("imp_per_day").textContent = result.healthdata[0].imp_recom;
            document.getElementById("imp_per_post").textContent = result.healthdata[0].impPost_recom;

            // health dashboard trend
            document.getElementById("link_impressions").href = result.advancedreport + "#impressions";
            if (result.healthdata[0].imp_slope > 0 && result.healthdata[0].imp_p_value < 0.05 ) {
              document.getElementById("impression_trend").src = "https://storage.googleapis.com/msgsndr/PdMChW3b3rqeve2L755O/media/674f7b849264c9295eed70ca.png";
            } else if (result.healthdata[0].imp_slope < 0 && result.healthdata[0].imp_p_value < 0.05) {
              document.getElementById("impression_trend").src = "https://storage.googleapis.com/msgsndr/PdMChW3b3rqeve2L755O/media/674f7b84251b397cd5eea9cb.png";
            } else {
              document.getElementById("impression_trend").src = "https://storage.googleapis.com/msgsndr/PdMChW3b3rqeve2L755O/media/67805cbdc845015f8a12761e.png";
            }

            document.getElementById("link_engagement").href = result.advancedreport + "#engagement";
            if (result.healthdata[0].eng_slope > 0 && result.healthdata[0].eng_p_value < 0.05 ) {
              document.getElementById("engagement_trend").src = "https://storage.googleapis.com/msgsndr/PdMChW3b3rqeve2L755O/media/674f7b849264c9295eed70ca.png";
            } else if (result.healthdata[0].eng_slope < 0 && result.healthdata[0].eng_p_value < 0.05) {
              document.getElementById("engagement_trend").src = "https://storage.googleapis.com/msgsndr/PdMChW3b3rqeve2L755O/media/674f7b84251b397cd5eea9cb.png";
            } else {
              document.getElementById("engagement_trend").src = "https://storage.googleapis.com/msgsndr/PdMChW3b3rqeve2L755O/media/67805cbdc845015f8a12761e.png";
            }

            document.getElementById("link_followers").href = result.advancedreport + "#followers";
            if (result.healthdata[0].foll_slope > 0 && result.healthdata[0].foll_p_value < 0.05 ) {
              document.getElementById("follower_trend").src = "https://storage.googleapis.com/msgsndr/PdMChW3b3rqeve2L755O/media/674f7b849264c9295eed70ca.png";
            } else if (result.healthdata[0].foll_slope < 0 && result.healthdata[0].foll_p_value < 0.05) {
              document.getElementById("follower_trend").src = "https://storage.googleapis.com/msgsndr/PdMChW3b3rqeve2L755O/media/674f7b84251b397cd5eea9cb.png";
            } else {
              document.getElementById("follower_trend").src = "https://storage.googleapis.com/msgsndr/PdMChW3b3rqeve2L755O/media/67805cbdc845015f8a12761e.png";
            }

            document.getElementById("link_posting_activity").href = result.advancedreport + "#posting_activity";
            if (result.healthdata[0].activity_slope > 0 && result.healthdata[0].activity_p_value < 0.05 ) {
              document.getElementById("post_activity_trend").src = "https://storage.googleapis.com/msgsndr/PdMChW3b3rqeve2L755O/media/674f7b849264c9295eed70ca.png";
            } else if (result.healthdata[0].activity_slope < 0 && result.healthdata[0].activity_p_value < 0.05) {
              document.getElementById("post_activity_trend").src = "https://storage.googleapis.com/msgsndr/PdMChW3b3rqeve2L755O/media/674f7b84251b397cd5eea9cb.png";
            } else {
              document.getElementById("post_activity_trend").src = "https://storage.googleapis.com/msgsndr/PdMChW3b3rqeve2L755O/media/67805cbdc845015f8a12761e.png";
            }

            // health dashboard benchmark
            document.getElementById("post_activity").textContent = ( result.healthdata[0].avgposts > 7 ? 7 : result.healthdata[0].avgposts ) + " / 7";
            if (result.healthdata[0].avgposts > 5) {
                document.getElementById("post_activity").style.color = "green";
            } else if (result.healthdata[0].avgposts <= 5 && result.healthdata[0].avgposts >= 3) {
                document.getElementById("post_activity").style.color = "orange";
            } else {
                document.getElementById("post_activity").style.color = "red";
            }

            document.getElementById("impressions").textContent = result.healthdata[0].imp_percentage + "%";
            if (result.healthdata[0].imp_percentage > 50) {
                document.getElementById("impressions").style.color = "green";
            } else if (result.healthdata[0].imp_percentage <= 50 && result.healthdata[0].imp_percentage > 25) {
                document.getElementById("impressions").style.color = "orange";
            } else {
                document.getElementById("impressions").style.color = "red";
            }

            document.getElementById("engagement").textContent = result.healthdata[0].eng_percentage + "%";
            if (result.healthdata[0].eng_percentage > 50) {
                document.getElementById("engagement").style.color = "green";
            } else if (result.healthdata[0].eng_percentage <= 50 && result.healthdata[0].eng_percentage > 25) {
                document.getElementById("engagement").style.color = "orange";
            } else {
                document.getElementById("engagement").style.color = "red";
            }

            document.getElementById("new_followers").textContent = result.healthdata[0].foll_percentage + "%";
            if (result.healthdata[0].foll_percentage > 50) {
                document.getElementById("new_followers").style.color = "green";
            } else if (result.healthdata[0].foll_percentage <= 50 && result.healthdata[0].foll_percentage > 25) {
                document.getElementById("new_followers").style.color = "orange";
            } else {
                document.getElementById("new_followers").style.color = "red";
            }

          } else {
            document.getElementById("apiResponse").textContent = "";
            errorMessage2.style.display = "block";
          }

        } else {
          document.getElementById("apiResponse").textContent = "Failed to fetch data. Please try again later.";
        }
      } catch (error) {
        console.error("Error calling API:", error);
        document.getElementById("apiResponse").textContent = "An error occurred while fetching data.";
      }
    } else {
      // If no email is configured, display an error message
      errorMessage.style.display = "block";
      document.getElementById("apiResponse").textContent = "";
    }
  });

  // Open the plugin options/settings page
  settingsButton.addEventListener("click", function () {
    chrome.runtime.openOptionsPage();
  });
});
