async function startAnalysis(url, useLlm) {
  removePanel();
  showLoadingPanel();

  try {
    // Delegate network request to background script to avoid Mixed Content issues
    const response = await chrome.runtime.sendMessage({
      type: "ANALYZE_VIDEO",
      url: url,
      useLlm: useLlm
    });

    if (chrome.runtime.lastError) {
      throw new Error(chrome.runtime.lastError.message);
    }

    if (!response || !response.success) {
      throw new Error(response.error || "Unknown backend error");
    }

    const data = response.data;

    // ---- ROUTING FIX (IMPORTANT) ----
    if (data.route === "ABSA") {
      if (!data.absa_result || data.absa_result.length === 0) {
        showError("No aspects detected in this video");
        return;
      }
      showResults(data.absa_result);
    } else {
      showGeneralMessage(data.domain, data.confidence);
    }
  } catch (err) {
    console.error(err);
    showError("Failed to analyze video: " + err.message);
  }
}
console.log("ABSA Content Script Loaded");

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("Received message:", msg);
  if (msg.type === "START_ABSA_ANALYSIS" && msg.url) {
    startAnalysis(msg.url, msg.useLlm);
  }
});


// -------------------- UI COMPONENTS --------------------

function createBasePanel() {
  const panel = document.createElement("div");
  panel.id = "absa-panel";
  panel.style.position = "fixed";
  panel.style.top = "80px";
  panel.style.right = "20px";
  panel.style.width = "320px";
  panel.style.backgroundColor = "#fff"; // Light mode by default
  panel.style.color = "#000";
  panel.style.zIndex = "99999";
  panel.style.padding = "16px";
  panel.style.borderRadius = "12px";
  panel.style.boxShadow = "0 4px 20px rgba(0,0,0,0.2)";
  panel.style.fontFamily = "Roboto, Arial, sans-serif";
  panel.style.fontSize = "14px";
  panel.style.border = "1px solid #ccc";

  // Check for YouTube Dark Mode
  if (document.documentElement.getAttribute("dark") === "true") {
    panel.style.backgroundColor = "#212121";
    panel.style.color = "#fff";
    panel.style.border = "1px solid #333";
  }

  // Close button
  const closeBtn = document.createElement("button");
  closeBtn.innerText = "×";
  closeBtn.style.position = "absolute";
  closeBtn.style.top = "8px";
  closeBtn.style.right = "12px";
  closeBtn.style.background = "none";
  closeBtn.style.border = "none";
  closeBtn.style.color = "inherit";
  closeBtn.style.fontSize = "20px";
  closeBtn.style.cursor = "pointer";
  closeBtn.onclick = removePanel;
  panel.appendChild(closeBtn);

  return panel;
}

function removePanel() {
  const existing = document.getElementById("absa-panel");
  if (existing) existing.remove();
}

function showLoadingPanel() {
  const panel = createBasePanel();
  
  const content = document.createElement("div");
  content.innerHTML = `
    <h3 style="margin:0 0 10px 0;">Analyzing Video...</h3>
    <div style="display:flex; align-items:center; gap:10px;">
      <div class="absa-spinner" style="
        width: 20px; height: 20px; 
        border: 3px solid rgba(255,0,0,0.3); 
        border-top: 3px solid #f00; 
        border-radius: 50%;
        animation: spin 1s linear infinite;">
      </div>
      <span>Processing audio & comments...</span>
    </div>
    <style> @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } </style>
  `;
  
  panel.appendChild(content);
  document.body.appendChild(panel);
}

function showError(msg) {
  const panel = document.getElementById("absa-panel") || createBasePanel();
  if (!document.getElementById("absa-panel")) document.body.appendChild(panel);

  const content = document.createElement("div");
  content.innerHTML = `
    <h3 style="color:#d32f2f; margin:0 0 8px 0;">Error</h3>
    <p>${msg}</p>
  `;
  
  // Clear previous content (keep close button if reusing panel logic, but simplistic here)
  if (panel.children.length > 1) panel.innerHTML = ""; 
  // Re-add close button if we cleared it
  if (!panel.querySelector("button")) {
      const closeBtn = document.createElement("button");
      closeBtn.innerText = "×";
      closeBtn.style.cssText = "position:absolute; top:8px; right:12px; background:none; border:none; color:inherit; font-size:20px; cursor:pointer;";
      closeBtn.onclick = removePanel;
      panel.appendChild(closeBtn);
  }
  
  panel.appendChild(content);
}

function showResults(results) {
  const panel = document.getElementById("absa-panel");
  if (!panel) return;

  // Header
  let html = `<h3 style="margin:0 0 12px 0;">Aspect Extraction</h3>`;

  // List of results
  if (!results || results.length === 0) {
    html += `<p>No specific aspects found.</p>`;
  } else {
    html += `<div style="max-height:400px; overflow-y:auto; padding-right:5px;">`;
    
    results.forEach(item => {
      const sentimentColor = {
        "positive": "#4caf50", // Green
        "negative": "#f44336", // Red
        "neutral":  "#9e9e9e"  // Grey
      }[item.sentiment] || "#9e9e9e";

      html += `
        <div style="
          margin-bottom: 8px; 
          padding: 8px; 
          border-left: 4px solid ${sentimentColor};
          background: rgba(128,128,128,0.1);
          border-radius: 4px;
        ">
          <div style="font-weight:bold; font-size:13px;">${item.aspect}</div>
          <div style="font-size:11px; color:${sentimentColor}; text-transform:uppercase; margin-top:2px;">
            ${item.sentiment}
          </div>
        </div>
      `;
    });
    
    html += `</div>`;
  }

  // Preserve close button
  const closeBtn = panel.querySelector("button");
  panel.innerHTML = html;
  panel.appendChild(closeBtn);
}

function showGeneralMessage(domain, confidence) {
  const panel = document.getElementById("absa-panel");
  if (!panel) return;

  panel.innerHTML = `
    <h3 style="margin-bottom:6px;">ℹ️ Analysis Skipped</h3>
    <div>This video is not related to food reviews.</div>
    <div style="margin-top:6px; font-size:12px; opacity:0.7;">
      Detected domain: <b>${domain}</b><br/>
      Confidence: ${confidence}
    </div>
  `;
  
  // Re-append close button
  const closeBtn = document.createElement("button");
  closeBtn.innerText = "×";
  closeBtn.style.cssText = "position:absolute; top:8px; right:12px; background:none; border:none; color:inherit; font-size:20px; cursor:pointer;";
  closeBtn.onclick = removePanel;
  panel.appendChild(closeBtn);
}

