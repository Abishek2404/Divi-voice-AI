export const toolDeclarations = [
  {
    type: "function",
    name: "openWebsite",
    description: "Open a specified URL in the browser.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The full URL to open (e.g. https://www.google.com)"
        }
      },
      required: ["url"]
    }
  },
  {
    type: "function",
    name: "searchGoogle",
    description: "Search Google for a query.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query"
        }
      },
      required: ["query"]
    }
  },
  {
    type: "function",
    name: "searchYouTube",
    description: "Search YouTube for a video.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query"
        }
      },
      required: ["query"]
    }
  },
  {
    type: "function",
    name: "playYouTubeVideo",
    description: "Click on the first video result in YouTube to play it.",
    parameters: {
      type: "object",
      properties: {}
    }
  },
  {
    type: "function",
    name: "openSpotify",
    description: "Open Spotify.",
    parameters: {
      type: "object",
      properties: {}
    }
  },
  {
    type: "function",
    name: "playSpotifyPlaylist",
    description: "Open a specific playlist on Spotify.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name of the playlist"
        }
      },
      required: ["name"]
    }
  },
  {
    type: "function",
    name: "openInstagram",
    description: "Open Instagram.",
    parameters: {
      type: "object",
      properties: {}
    }
  },
  {
    type: "function",
    name: "searchInstagramUser",
    description: "Search for a user on Instagram.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name or username to search"
        }
      },
      required: ["name"]
    }
  },
  {
    type: "function",
    name: "openInstagramChat",
    description: "Open chat with the searched Instagram user.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name or username of the user"
        }
      },
      required: ["name"]
    }
  },
  {
    type: "function",
    name: "typeInstagramMessage",
    description: "Type a message in the Instagram chat (does not send it).",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The message text to type"
        }
      },
      required: ["text"]
    }
  },
  {
    type: "function",
    name: "sendInstagramMessage",
    description: "Send the typed message on Instagram.",
    parameters: {
      type: "object",
      properties: {}
    }
  },
  {
    type: "function",
    name: "openFacebook",
    description: "Open Facebook.",
    parameters: {
      type: "object",
      properties: {}
    }
  },
  {
    type: "function",
    name: "openGmail",
    description: "Open Gmail.",
    parameters: {
      type: "object",
      properties: {}
    }
  },
  {
    type: "function",
    name: "openNetflix",
    description: "Open Netflix.",
    parameters: {
      type: "object",
      properties: {}
    }
  },
  {
    type: "function",
    name: "browserClick",
    description: "Click an element on the page using a CSS selector or text.",
    parameters: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector or text to click"
        }
      },
      required: ["selector"]
    }
  },
  {
    type: "function",
    name: "browserType",
    description: "Type text into an input field.",
    parameters: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector of the input field"
        },
        text: {
          type: "string",
          description: "Text to type"
        }
      },
      required: ["selector", "text"]
    }
  },
  {
    type: "function",
    name: "browserScroll",
    description: "Scroll down the current page.",
    parameters: {
      type: "object",
      properties: {}
    }
  },
  {
    type: "function",
    name: "browserWait",
    description: "Wait for a short period.",
    parameters: {
      type: "object",
      properties: {
        ms: {
          type: "number",
          description: "Milliseconds to wait"
        }
      }
    }
  },
  {
    type: "function",
    name: "closeBrowser",
    description: "Close the browser.",
    parameters: {
      type: "object",
      properties: {}
    }
  }
];
