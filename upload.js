const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

function sleep(ms){
  return new Promise(resolve => setTimeout(resolve, ms))
}

function sanitizeTitle(title){

  if(!title) return "TOEIC Practice | Learn English"

  return title
    .replace(/[\u{1F300}-\u{1FAFF}]/gu,"")
    .replace(/\s+/g," ")
    .trim()
    .slice(0,95)
}

function getRandomComment(){
  const comments = JSON.parse(fs.readFileSync("./comments.json","utf8"))
  return comments[Math.floor(Math.random()*comments.length)]
}

function getRandomCaption(type){

  const file = `./captions/${type}.json`

  if(!fs.existsSync(file)){
    console.log("Caption file not found:", file)
    return ""
  }

  try{

    const data = JSON.parse(fs.readFileSync(file,"utf8"))

    if(!data.captions || data.captions.length === 0)
      return ""

    const captions = data.captions

    return captions[Math.floor(Math.random()*captions.length)]

  }catch(err){

    console.log("Caption JSON error:", err.message)

    return ""
  }

}

const HASHTAGS = {

  vocab: [
    "#toeicvocab",
    "#learnenglish",
    "#englishvocabulary",
    "#toeicwords",
    "#hoctienganh"
  ],

  part1: [
    "#toeicpart1",
    "#toeiclistening",
    "#englishlistening",
    "#toeicpractice",
    "#learnenglish"
  ],

  part2: [
    "#toeicpart2",
    "#toeiclistening",
    "#englishpractice",
    "#toeicpractice",
    "#learnenglish"
  ],

  sentence: [
    "#englishsentence",
    "#toeicgrammar",
    "#learnenglish",
    "#toeicpractice",
    "#englishstudy"
  ]

}

function getRandomHashtags(type,count=3){

  const list = HASHTAGS[type] || []

  if(list.length===0) return ""

  const shuffled=[...list].sort(()=>0.5-Math.random())

  return shuffled.slice(0,count).join(" ")

}

function buildTitle(type, caption, number){

  let prefix = "TOEIC Practice"

  if(type === "part1")
    prefix = "TOEIC Part 1"

  else if(type === "part2")
    prefix = "TOEIC Part 2"

  else if(type === "vocab")
    prefix = "TOEIC Vocabulary"

  else if(type === "sentence")
    prefix = "TOEIC Sentence"

  const hashtags = getRandomHashtags(type)

  if(!caption || caption.trim()==="")
    caption = "Improve your TOEIC English"

  return `${prefix} #${number} | ${caption} ${hashtags}`
}

const PLAYLISTS = {
  vocab: "PLIRmjh9pcXwNHJo2S_XRzlUYvrvbJkk1K",
  part1: "PLIRmjh9pcXwMgVILPLAxaQ-2PIqKxp3II",
  part2: "PLIRmjh9pcXwPuNDZVdJns_bu2Q9yZW0Lf",
  sentence: "PLIRmjh9pcXwNSvV_IgbqdqURU5GmXVJS5"
}

const SCHEDULE = [
  { time: "07:30", type: "vocab" },
  { time: "10:30", type: "part1" },
  { time: "13:30", type: "sentence" },
  { time: "16:30", type: "part2" },
  { time: "19:30", type: "part1" },
  { time: "22:00", type: "part2" }
]

function getNowGMT7(){

  const now = new Date()
  const utc = now.getTime() + now.getTimezoneOffset()*60000
  const gmt7 = new Date(utc + 7*60*60*1000)

  return gmt7
}

function getToday(){

  const now = getNowGMT7()

  const yyyy = now.getFullYear()
  const mm = String(now.getMonth()+1).padStart(2,"0")
  const dd = String(now.getDate()).padStart(2,"0")

  return `${yyyy}-${mm}-${dd}`
}

function toMinutes(t){
  const [h,m] = t.split(":").map(Number)
  return h*60+m
}

function matchContentType(file,type){

  const name = file.toLowerCase()

  if(type==="vocab") return name.includes("vocab")
  if(type==="sentence") return name.includes("sentence")
  if(type==="part1") return name.includes("part1") || name.includes("part-1")
  if(type==="part2") return name.includes("part2") || name.includes("part-2")

  return false
}

function detectPlaylist(file){

  const name = file.toLowerCase()

  if(name.includes("vocab")) return PLAYLISTS.vocab
  if(name.includes("sentence")) return PLAYLISTS.sentence
  if(name.includes("part1") || name.includes("part-1")) return PLAYLISTS.part1
  if(name.includes("part2") || name.includes("part-2")) return PLAYLISTS.part2

  return null
}

function loadUploaded(){

  const file="./uploaded.json"

  if(!fs.existsSync(file)){
    fs.writeFileSync(file,JSON.stringify([],null,2))
    return []
  }

  try{
    const data=JSON.parse(fs.readFileSync(file,"utf8"))
    return Array.isArray(data)?data:[]
  }catch{
    fs.writeFileSync(file,JSON.stringify([],null,2))
    return []
  }
}

function saveUploaded(list){
  fs.writeFileSync("./uploaded.json",JSON.stringify(list,null,2))
}

function loadCounter(){

  const file="./counter.json"

  if(!fs.existsSync(file)){

    const init={
      vocab:0,
      part1:0,
      part2:0,
      sentence:0
    }

    fs.writeFileSync(file,JSON.stringify(init,null,2))
    return init
  }

  return JSON.parse(fs.readFileSync(file,"utf8"))
}

function saveCounter(data){

  fs.writeFileSync(
    "./counter.json",
    JSON.stringify(data,null,2)
  )

}

async function addToPlaylist(youtube,playlistId,videoId){

  await youtube.playlistItems.insert({
    part:"snippet",
    requestBody:{
      snippet:{
        playlistId,
        resourceId:{
          kind:"youtube#video",
          videoId
        }
      }
    }
  })
}

async function postComment(youtube,videoId,text){

  const res=await youtube.commentThreads.insert({
    part:"snippet",
    requestBody:{
      snippet:{
        videoId,
        topLevelComment:{
          snippet:{ textOriginal:text }
        }
      }
    }
  })

  return res.data.id
}

async function pinComment(youtube,commentId){

  await youtube.comments.setModerationStatus({
    id:commentId,
    moderationStatus:"published"
  })
}

async function uploadVideo(youtube,filePath,type,number){

  console.log("Uploading:",filePath)

  const caption = getRandomCaption(type)

  let title = buildTitle(type, caption, number)

  title = sanitizeTitle(title)

  console.log("Final title:",title)

  const description =
`Luyện TOEIC mỗi ngày.

Làm bài đánh giá năng lực TOEIC miễn phí:
https://placement.themvptoeic.com/?Source=youtube_short

#toeic
#learnenglish
#shorts`

  const res=await youtube.videos.insert({

    part:"snippet,status",

    requestBody:{
      snippet:{
        title: title,
        description: description,
        tags:["toeic","toeic practice"],
        categoryId:"27"
      },

      status:{
        privacyStatus:"public",
        selfDeclaredMadeForKids:false
      }
    },

    media:{
      body:fs.createReadStream(filePath)
    }
  })

  const videoId=res.data.id

  console.log("Uploaded:",videoId)

  const playlistId=detectPlaylist(path.basename(filePath))

  if(playlistId){

    await addToPlaylist(youtube,playlistId,videoId)

    console.log("Added to playlist")

  }

  const delay = 60000 + Math.random()*60000
  await sleep(delay)

  try{

    const commentId=await postComment(
      youtube,
      videoId,
      getRandomComment()
    )

    await sleep(5000)

    await pinComment(youtube,commentId)

    console.log("Comment pinned")

  }catch(err){

    console.log("Comment error",err.message)

  }

}

async function main(){

  const now=getNowGMT7()
  const nowMin=now.getHours()*60+now.getMinutes()
  const today=getToday()

  console.log("Current time:",now.toLocaleString())

  const uploaded=loadUploaded()
  const counter=loadCounter()

  const todayFolder=path.join("./videos",today)

  if(!fs.existsSync(todayFolder)){

    console.log("No folder:",todayFolder)
    return
  }

  const allVideos=fs.readdirSync(todayFolder)
    .filter(f=>f.endsWith(".mp4"))

  const credentials=JSON.parse(fs.readFileSync("client_secret.json","utf8"))
  const token=JSON.parse(fs.readFileSync("token.json","utf8"))

  const {client_secret,client_id,redirect_uris}=credentials.installed

  const auth=new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  )

  auth.setCredentials(token)

  const youtube=google.youtube({version:"v3",auth})

  for(const slot of SCHEDULE){

    const slotMin=toMinutes(slot.time)

    if(slotMin>nowMin) continue

    const already=uploaded.find(x=>x.includes(`${today}|${slot.time}`))

    if(already) continue

    console.log("Slot matched:",slot.time,slot.type)

    const candidates=allVideos.filter(file=>{

      if(!matchContentType(file,slot.type))
        return false

      if(uploaded.includes(`${today}/${file}`))
        return false

      return true
    })

    if(candidates.length===0){

      console.log("No video for",slot.type)
      continue
    }

    const file=candidates[Math.floor(Math.random()*candidates.length)]
    const filePath=path.join(todayFolder,file)

    counter[slot.type]++
    const number=counter[slot.type]

    await uploadVideo(youtube,filePath,slot.type,number)

    uploaded.push(`${today}/${file}`)
    uploaded.push(`${today}|${slot.time}`)

    saveUploaded(uploaded)
    saveCounter(counter)

    console.log("Uploaded for slot",slot.time)

    return
  }

  console.log("Nothing to upload")

}

main()
