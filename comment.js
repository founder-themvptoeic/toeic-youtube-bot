const { google } = require("googleapis")
const fs = require("fs")

async function commentVideo(videoId, text) {

  const credentials = JSON.parse(fs.readFileSync("client_secret.json"))
  const token = JSON.parse(fs.readFileSync("token.json"))

  const { client_secret, client_id, redirect_uris } =
    credentials.installed

  const auth = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  )

  auth.setCredentials(token)

  const youtube = google.youtube({
    version: "v3",
    auth
  })

  const res = await youtube.commentThreads.insert({
    part: "snippet",
    requestBody: {
      snippet: {
        videoId: videoId,
        topLevelComment: {
          snippet: {
            textOriginal: text
          }
        }
      }
    }
  })

  console.log("Comment posted:", res.data.id)

}

module.exports = commentVideo