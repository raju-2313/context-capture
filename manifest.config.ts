{
  "manifest_version": 3,
  "name": "ContextCapture",
  "version": "1.0.0",
  "description": "Capture anything while browsing. Preserve tab context. Find it again. Local-first, no account.",
  "permissions": [
    "activeTab",
    "scripting",
    "contextMenus",
    "storage",
    "sidePanel",
    "downloads",
    "offscreen"
  ],
  "optional_permissions": [],
  "host_permissions": [],
  "content_scripts": [],
  "background": {
    "service_worker": "background.js"
  },
  "side_panel": {
    "default_path": "sidepanel/index.html"
  },
  "action": {
    "default_title": "ContextCapture",
    "default_popup": "popup/index.html"
  },
  "options_ui": {
    "page": "options/index.html",
    "open_in_tab": true
  },
  "commands": {
    "capture-text": {
      "suggested_key": {
        "default": "Ctrl+Shift+C",
        "mac": "Command+Shift+C"
      },
      "description": "Capture selected text"
    },
    "capture-screenshot": {
      "suggested_key": {
        "default": "Ctrl+Shift+S",
        "mac": "Command+Shift+S"
      },
      "description": "Capture screenshot"
    },
    "quick-note": {
      "suggested_key": {
        "default": "Ctrl+Shift+N",
        "mac": "Command+Shift+N"
      },
      "description": "Quick note"
    },
    "open-panel": {
      "suggested_key": {
        "default": "Ctrl+Shift+P",
        "mac": "Command+Shift+P"
      },
      "description": "Open side panel"
    }
  },
  "web_accessible_resources": [
    {
      "resources": ["icons/*", "permissions.html"],
      "matches": ["<all_urls>"]
    }
  ],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
