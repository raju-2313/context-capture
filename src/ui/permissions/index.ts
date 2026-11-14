async function requestMicrophone(): Promise<void> {
  const status = document.getElementById("status");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    status!.textContent = "Microphone permission granted. You can return to ContextCapture.";
    await chrome.runtime.sendMessage({ type: "MIC_PERMISSION_RESULT", granted: true });
  } catch {
    status!.textContent = "Microphone permission was denied or no microphone is available.";
    await chrome.runtime.sendMessage({ type: "MIC_PERMISSION_RESULT", granted: false });
  } finally {
    window.setTimeout(() => window.close(), 500);
  }
}

void requestMicrophone();
