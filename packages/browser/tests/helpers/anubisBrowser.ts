import { Camoufox } from "camoufox-js"

// Match the worker sizing used by the small-container smoke tests.
export const launchAnubisBrowser = () =>
  Camoufox({
    headless: true,
    geoip: false,
    config: { "navigator.hardwareConcurrency": 4 },
    firefox_user_prefs: {
      "dom.ipc.processCount": 2,
      "dom.ipc.contentProcessCount": 2,
      "dom.ipc.processPrelaunch": false,
    },
  })
