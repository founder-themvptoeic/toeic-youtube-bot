const fs = require("fs")
const { google } = require("googleapis")
const readline = require("readline")

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.force-ssl"
]
async function authorize() {

  const credentials = JSON.parse(fs.readFileSync("client_secret.json"))

  const { client_secret, client_id, redirect_uris } =
    credentials.installed

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  )

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES
  })

  console.log("\nOpen this URL in your browser:\n")
  console.log(authUrl)

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  rl.question("\nPaste the authorization code here: ", async (code) => {

    const { tokens } = await oAuth2Client.getToken(code)

    oAuth2Client.setCredentials(tokens)

    fs.writeFileSync("token.json", JSON.stringify(tokens))

    console.log("\n✅ Token saved to token.json")

    rl.close()
  })
}

authorize()