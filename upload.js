const fs = require("fs")
const path = require("path")
const { google } = require("googleapis")

function sleep(ms){
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getRandomComment(){
  console.log("Loading comments.json")
  const comments = JSON.parse(fs.readFileSync("./comments.json","utf8"))
  console.log("Comments count:", comments.length)
  return comments[Math.floor(Math.random()*comments.length)]
}

function getRandomCaption(type){

  const file = `./captions/${type}.json`

  console.log("Reading caption file:", file)

  if(!fs.existsSync(file)){
    console.log("❌ Caption file not found:", file)
    return ""
  }

  try{

    const raw = fs.readFileSync(file,"utf8")
    console.log("Caption raw size:", raw.length)

    const data = JSON.parse(raw)

    if(!data.captions || data.captions.length === 0){
      console.log("⚠ captions array missing or empty")
      return ""
    }

    const captions = data.captions

    const caption = captions[Math.floor(Math.random()*captions.length)]

    console.log("Selected caption:", caption)

    return caption

  }catch(err){

    console.log("❌ Caption JSON error:", err.message)

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

  console.log("Hashtag pool:", list)

  if(list.length===0){
    console.log("⚠ No hashtags for type:", type)
    return ""
  }

  const shuffled=[...list].sort(()=>0.5-Math.random())

  const tags = shuffled.slice(0,count).join(" ")

  console.log("Selected hashtags:", tags)

  return tags

}

function buildTitle(type, caption, number){

  console.log("Building title with:", {type,caption,number})

  let prefix = "TOEIC Practice"

  if(type === "part1")
    prefix = "🎧 TOEIC Part 1"

  else if(type === "part2")
    prefix = "🎧 TOEIC Part 2"

  else if(type === "vocab")
    prefix = "📚 TOEIC Vocabulary"

  else if(type === "sentence")
    prefix = "💬 TOEIC Sentence"

  const hashtags = getRandomHashtags(type)

  if(!caption || caption.trim()===""){
    console.log("⚠ Caption empty → fallback caption")
    caption = "Improve your TOEIC English"
  }

  const title = `${prefix} #${number} | ${caption} ${hashtags}`

  console.log("Generated title:", title)

  if(!title || title.length < 5){
    console.log("⚠ Invalid title fallback triggered")
    return "TOEIC Practice | Learn English #shorts"
  }

  return title
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

  const match =
    (type==="vocab" && name.includes("vocab")) ||
    (type==="sentence" && name.includes("sentence")) ||
    (type==="part1" && (name.includes("part1") || name.includes("part-1"))) ||
    (type==="part2" && (name.includes("part2") || name.includes("part-2")))

  console.log("Check file:",file,"type:",type,"match:",match)

  return match
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
    console.log("Creating uploaded.json")
    fs.writeFileSync(file,JSON.stringify([],null,2))
    return []
  }

  return JSON.parse(fs.readFileSync(file,"utf8"))
}

function saveUploaded(list){
  fs.writeFileSync("./uploaded.json",JSON.stringify(list,null,2))
}

function loadCounter(){

  const file="./counter.json"

  if(!fs.existsSync(file)){

    console.log("Creating counter.json")

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

async function uploadVideo(youtube,filePath,type,number){

  console.log("Uploading file:",filePath)

  const caption = getRandomCaption(type)
  const title = buildTitle(type, caption, number)

  console.log("FINAL TITLE SENT TO YOUTUBE:", title)

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

  console.log("Uploaded videoId:",videoId)

}

async function main(){

  const now=getNowGMT7()
  const nowMin=now.getHours()*60+now.getMinutes()
  const today=getToday()

  console.log("Current time:",now.toLocaleString())
  console.log("Today folder:",today)

  const uploaded=loadUploaded()
  const counter=loadCounter()

  const todayFolder=path.join("./videos",today)

  console.log("Looking for folder:",todayFolder)

  if(!fs.existsSync(todayFolder)){

    console.log("❌ No folder:",todayFolder)
    return
  }

  const allVideos=fs.readdirSync(todayFolder)
    .filter(f=>f.endsWith(".mp4"))

  console.log("Videos found:",allVideos)

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

    console.log("Candidates:",candidates)

    if(candidates.length===0){

      console.log("No video for",slot.type)
      continue
    }

    const file=candidates[Math.floor(Math.random()*candidates.length)]

    const filePath=path.join(todayFolder,file)

    counter[slot.type]++
    const number=counter[slot.type]

    console.log("Uploading candidate:",file)
    console.log("Counter:",number)

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
