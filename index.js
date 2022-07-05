const PORT = 8080
const axios = require('axios')
const cheerio = require('cheerio')
const express = require('express')
var mysql = require('mysql');
const app = express()
const cors = require('cors')
app.use(cors())


app.get('/', function (req, res) {
  res.json('WG Webscraper')
})

app.get('/results', (req, res) => {
  getWEData()
  res.json('WG Webscraper')
})

//import config from './src/config.json'
const config = require('./src/config.json')

var connection = mysql.createConnection({
  host: config.database.host,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database
});


//handle disconnects
connection.on('error', function (err) {
  console.log('db error', err)
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    connection = mysql.createConnection({
      host: config.database.host,
      user: config.database.user,
      password: config.database.password,
      database: config.database.database
    });
  } else {
    throw err;
  }
});

// safe to database
function safeToDatabase(data) {
  // check if data is already in database
  connection.query('SELECT * FROM Projekte WHERE Name = ' + mysql.escape(data.name), function (err, result) {
    if (err) throw err;
    if (result.length === 0) {
      // insert data into database with mysql
      connection.query('INSERT INTO Projekte (Name,URL) VALUES (' + mysql.escape(data.name) + ',' + mysql.escape(data.url) + ')', function (err, result) {
        if (err) throw err;
        console.log('Eintrag erstellt');
      });
    } else {
      console.log('Eintrag vorhanden')
      // get id from the result object
      var id = result[0].ID;

      // write versions to database
      connection.query('INSERT INTO Resultate (Projekt_ID,Result,WE,PHP,SQLVersion) VALUES (' + id + ',' + mysql.escape(JSON.stringify(data.versions)) + ',' + mysql.escape(data.versions.version) + ',' + mysql.escape(data.versions.phpVersion) + ',' + mysql.escape(data.versions.sqlVersion) + ')', function (err, result) {
        if (err) throw err;
        console.log('Eintrag geschrieben');
      });

    }
  });
  // close connection
}

//import urls from './urls.json'
const urls = require('./src/urls.json')

// running function for every entry in urls
// define function 
function getWEData() {
  urls.forEach(urlData => {
    axios(urlData.urlAPI)
      .then(response => {
        const json = response.data
        const data = {}

        // Daten definieren
        data.name = urlData.name
        data.url = urlData.url
        data.urlAPI = urlData.urlAPI
        data.versions = json

        // safe to database
        safeToDatabase(data);

      }).catch(err => console.log(err))
  })
}


function getWEIncludes() {
  urls.forEach(urlData => {
    axios(urlData.urlAPI)
      .then(response => {
        const html = response.data
        const $ = cheerio.load(html)
        const data = {}
        $('h1', html).each(function () { //<-- cannot be a function expression
          data.title = $(this).text()
          data.name = urlData.name
          data.url = urlData.url
          data.urlAPI = urlData.urlAPI
        })
        console.log(data)
        console.log(urlData.name)
        // safe to database
        safeToDatabase(data);

      }).catch(err => console.log(err))
  })
}


// run function every 6 hours
setInterval(() => {
  getArticles()
}, 3600000)



app.listen(PORT, () => console.log(`server running on PORT ${PORT}`))

