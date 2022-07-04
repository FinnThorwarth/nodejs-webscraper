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
  axios(url)
    .then(response => {
      const html = response.data
      const $ = cheerio.load(html)
      const articles = []

      $('h1', html).each(function () { //<-- cannot be a function expression
        const title = $(this).text()
        const url = $(this).find('a').attr('href')
        articles.push({
          title,
          url
        })
      })
      res.json(articles)
    }).catch(err => console.log(err))

})

//import config from './src/config.json'
const config = require('./src/config.json')

var connection = mysql.createConnection({
  host     : config.database.host,
  user     : config.database.user,
  password : config.database.password
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
        const articles = []
        $('h1', html).each(function () { //<-- cannot be a function expression
          const title = $(this).text()
          const url = $(this).find('a').attr('href')
          articles.push({
            title,
            url
          })
        })
        console.log(articles)
      }).catch(err => console.log(err))
  })
}
// run function every 6 hours
setInterval(() => {
  getArticles()
}, 21600000)



app.listen(PORT, () => console.log(`server running on PORT ${PORT}`))

