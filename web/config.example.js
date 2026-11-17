// Copy this file to config.js and fill in the two values from Supabase
// (Project settings > API Keys). Use the PUBLISHABLE key only. Never put the
// secret key in anything under web/: it runs in the browser.
window.NEST_CONFIG = {
  SUPABASE_URL: "https://your-project.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_placeholder",
  // Optional: lets teachers save Excel registers to their own Google Drive.
  // Leave empty to keep only the Download button. See docs/google-drive-setup.md
  GOOGLE_CLIENT_ID: ""
};
