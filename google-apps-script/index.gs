const POST_URL = 'TODO' // take the value of `uploadEndpoint` from the cloudformation stack outputs
const BASE_searchQuery = 'newer_than:2h has:attachment'
const UPLOAD_AUTH_PASSWORD = 'TODO' // should match the value of 'UPLOAD_AUTH_PASSWORD' in .env

const CONFIGS = [
  {
    //edit these values as necessary
    searchQuery: `${BASE_searchQuery} from:(office@school.name.com)`,
    emailSubjectRegex: /Newsletter.*/i,
    attachmentRegex: /School Newsletter .*\.pdf$/i,
    inputId: 'school1' // must match the 'inputId' in config.yaml
  }
  //repeat config block for each 'input' listed in config.yaml
];

function processEmailsToApi() {
  CONFIGS.forEach(config => {
    Logger.log(config.inputId)
    const threads = GmailApp.search(config.searchQuery);
    threads.forEach(thread => {
      const messages = thread.getMessages();
      messages.forEach(message => {
        const subject = message.getSubject();
        Logger.log(subject)
        if (config.emailSubjectRegex.test(subject)) {
          const attachments = message.getAttachments();
          attachments.forEach(attachment => {
            Logger.log(attachment.getName())
            if (config.attachmentRegex.test(attachment.getName())) {
              postToEndpoint(config, attachment);
            }
          });
        }
      });
    });
  })
}

function postToEndpoint(config, blob) {

  const url = `${POST_URL}${config.inputId}/input.pdf`
  const options = {
    'method': 'put',
    'payload': blob,
    'followRedirects': true,
    'muteHttpExceptions': true,
    'headers': {
      'x-auth-password': UPLOAD_AUTH_PASSWORD
    }
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    Logger.log(`Response body: ${response.getContentText()}`);
    Logger.log(`Sent: ${blob.getName()} | Status: ${response.getResponseCode()}`);
  } catch (e) {
    Logger.log(`Error sending ${blob.getName()}: ${e.toString()}`);
  }
}

function createHourlyTrigger() {
  // Check if trigger already exists to avoid duplicates
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'processEmailsToApi') return;
  }
  
  ScriptApp.newTrigger('processEmailsToApi')
    .timeBased()
    .everyHours(1)
    .create();
}
