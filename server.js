// Server
const express = require('express')
const app = express()
const http = require('http').createServer(app)
const io = require('socket.io')(http)
const { MongoClient } = require('mongodb')

const cors = require('cors')
const bodyParser = require('body-parser')
const {v4: uuid} = require('uuid')
const bcrypt = require('bcrypt')
const schedule = require('node-schedule')
const jwt = require('jsonwebtoken')
const md5 = require('md5')

const config = require('./package.json')

const port = process.env.PORT || 8081
const mdb = process.env.MONGODB || "mongodb://localhost:27017/schoolnotes"

app.use(cors())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(express.json({limit: '1mb'}))

// #################################################
// Import express routers

// #################################################

// #################################################
// GET
// #################################################

app.get(['/', '/version', '/info'], (req, res) => {
    res.json({
        info: `${config.name}@${config.version}`,
        type: config.name,
        version: config.version,
    })
})

app.get('/share', async (req, res) => {
    const client = new MongoClient(mdb, { useUnifiedTopology: true })
    try {
        await client.connect()
        const db = client.db('school-notes')
        const sharedNotes = db.collection("sharedNotes")
        const result = await sharedNotes.findOne({_id: req.query._id})
        if (result)
            res.status(200).json({notes: result.notes})
        else{
            res.status(404).json({})}
    }
    catch(error){
        res.status(500).json({})
    }
    finally {
        await client.close()
    }
})

// #################################################
// POST
// #################################################

app.post('/share', async (req, res) => {
    const client = new MongoClient(mdb, { useUnifiedTopology: true })
    
    try {
        await client.connect()
        const db = client.db('school-notes')
        const sharedNotes = db.collection("sharedNotes")

        const hash = md5(JSON.stringify(req.body.notes))
        const r = await sharedNotes.find({hash: hash}).toArray()
        if (r.length === 0) {
            const _id = uuid()

            const today = new Date()
            const expires = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7).getTime()
            await sharedNotes.insertOne({ _id, notes: req.body.notes, expires, hash })

            res.status(201).json({_id})
        }
        else {
            res.status(201).json({_id: r[0]._id})
        }    
    }
    catch(error){
        res.status(500).json({})
    }
    finally {
        await client.close()
    }
})

// #################################################
// PUT
// #################################################

// #################################################
// DELETE
// #################################################

// #################################################
// SOCKET.IO
// #################################################

http.listen(port, () => console.log(`✅ Server listening on *:${port}`))