const PORT = 8080
const axios = require('axios')
const cheerio = require('cheerio')
const express = require('express')
var mysql = require('mysql');
const app = express()
const cors = require('cors')
app.use(cors())

const url = 'https://www.wg-werbeagentur.de'


app.get('/', function (req, res) {
  res.json('WG Webscraper')
})

app.get('/results', (req, res) => {
  getArticles()
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

connection.connect();

//import urls from './urls.json'
const urls = require('./src/urls.json')

// running function for every entry in urls
// define function 
function getArticles() {
  urls.forEach(url => {
    axios(url)
      .then(response => {
        const html = response.data
        const $ = cheerio.load(html)
        const data = {}
        $('h1', html).each(function () { //<-- cannot be a function expression
          data.title = $(this).text()
          data.name = url.name
          data.url = url.url
        })
        console.log(data)
        console.log(url.name)
        // safe to database
        safeToDatabase(data);

      }).catch(err => console.log(err))
  })
}

// safe to database
function safeToDatabase(data) {
  console.log(data.name);
  // check if data is already in database
  connection.query('SELECT * FROM Projekte WHERE Name = ' + mysql.escape(data.name), function (err, result) {
    if (err) throw err;
    if (result.length === 0) {
      // insert data into database with mysql
      connection.query('INSERT INTO Projekte (Name,URL) VALUES ('+ mysql.escape(data.name)+','+mysql.escape(data.url)+')' , function (err, result) {
        if (err) throw err;
        console.log('1 record inserted');
      });
    } else {
      console.log('data already in database')
    }
  });
}

// run function every 6 hours
setInterval(() => {
  getArticles()
}, 21600000)



app.listen(PORT, () => console.log(`server running on PORT ${PORT}`))

