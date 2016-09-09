var writer = require('to2')
var raf = require('raf')

function convertMap (maze) {
  var map = {}
  map['area'] = []
  maze.area.forEach(function (el) {
    var line = []
    for (var i = 0; i < el.x.length; i++) {
      line.push([el.x[i], el.y[i]])
    }
    map['area'].push(line)
  })
  map['borders'] = []
  maze.borders.forEach(function (el) {
    var line = []
    for (var i = 0; i < el.x.length; i++) {
      line.push([el.x[i], el.y[i]])
    }
    map['borders'].push(line)
  })
  map['triggers'] = []
  maze.triggers.forEach(function (el) {
    var line = []
    for (var i = 0; i < el.x.length; i++) {
      line.push([el.x[i], el.y[i]])
    }
    map['triggers'].push(line)
  })
  map['links'] = []
  maze.links.forEach(function (el) {
    map['links'].push([[el.x[0], el.y[0]], [el.x[1], el.y[1]]], [[el.x[2], el.y[2]], [el.x[3], el.y[3]]])
  })
  return map
}

module.exports = function () {
  var map = null
  var playerShape = [[-2,-1.5], [0, 1.5], [2, -1.5]]
  var playerStart = [0, 0.5]

  return {
    createStream: function (initMap) {
      map = convertMap(initMap)
      var canvas = document.createElement('canvas')
      canvas.width = 600
      canvas.height = 800
      canvas.style.backgroundColor = '#000000'
      document.body.appendChild(canvas)

      drawPolygon = function (context, points, props) {
        if (props.fill || props.stroke) {
          if (props.shadow) {
            context.shadowBlur = props.shadow.size
            context.shadowColor = props.shadow.color
          }
          context.beginPath()
          context.lineCap = 'round'
          points.forEach(function (xy) {
            context.lineTo(xy[0], xy[1])
          })
          //context.closePath()
          context.lineWidth = props.thickness || 1
          context.fillStyle = props.fill
          context.strokeStyle = props.stroke
          if (props.stroke) context.stroke()
          if (props.fill) context.fill()
          if (props.shadow) {
            context.shadowBlur = 0
          }
        }
      }

      scale = function (canvas, points) {
        width = 75.6 // determine automatically from map as max - min
        height = 95.4 // determine automatically from map as max - min
        return points.map(function (xy) {
          return [xy[0]/width*canvas.width/2*0.90 + canvas.width / 2, 0.9625*canvas.height - 0.925*xy[1]/height*canvas.height]
        })
      }

      shift = function (orig, points) {
        return points.map(function (xy) {
          return [xy[0] + orig[0], xy[1] + orig[1]]
        })
      }

      var context = canvas.getContext('2d');
      var position = playerStart
      var hit = [[[position, position], [position, position]], [[position, position], [position, position]], [[position, position], [position, position]]]

      var results = {
          trial: 0,
          velocityForward: 0,
          velocityLateral: 0,
          wallLeft: 0,
          wallRight: 0,
          wallForward: 0,
          reward: false,
          collision: false,
          link: false,
          advance: false,
          response: false,
          elapsedTime: 0
        }
        var rewards = 0
        var responses = 0
        var timeEl =  document.createElement('h2')
        
        timeEl.innerHTML = 'Time: ' + (results.elapsedTime/1000).toFixed(1)
        document.body.appendChild(timeEl)

        var trialNumEl =  document.createElement('h2')
        trialNumEl.innerHTML = 'Trial number: ' + results.trialNumber
        document.body.appendChild(trialNumEl)

        createLED = function () {
          var LED = document.createElement('canvas')
          LED.width = 40
          LED.height = 40
          LED.style.backgroundColor = '#000000'
          LED.style.border = '2px solid white'
          return LED
        }
        
        var rewardLED = createLED()
        var responseLED = createLED()
        var collisionLED = createLED()
        document.body.appendChild(rewardLED)
        document.body.appendChild(responseLED)
        document.body.appendChild(collisionLED)


        var wdL =  document.createElement('h2')
        wdL.innerHTML = 'Left wall distance: ' + results.wallLeft + ' mm'
        document.body.appendChild(wdL)
        var wdR =  document.createElement('h2')
        wdR.innerHTML = 'Right wall distance: ' + results.wallRight + ' mm'
        document.body.appendChild(wdR)
        var wdF =  document.createElement('h2')
        wdF.innerHTML = 'Forward wall distance: ' + results.wallForward + ' mm'
        document.body.appendChild(wdF)
        var speedEl =  document.createElement('h2')
        var speed = (results.velocityForward**2 + results.velocityLateral**2)**(0.5)
        speedEl.innerHTML = 'Speed: ' + speed.toFixed(1) + ' cm/s'
        document.body.appendChild(speedEl)


        var line = require('lightning-line-streaming')
        var divG = document.createElement('div')
        divG.style.width='500px'
        var elG = document.body.appendChild(divG)
        var xTime = new Array(300).fill(0)
        var ySpeed = new Array(300).fill(0)
        var yDeltaTime = new Array(300).fill(0)
        var vizGraph = new line(elG, {
          'series': ySpeed,
          'index': xTime,
          'xaxis': 'Time (s)',
          'yaxis': 'Speed (cm/s)',
          'thickness': 7,
          'color': [255, 100, 0]
        }, [], {'zoom': false})
        var yDomain = [0, 50]
        var xDomain = [-7, 0]

        var ySpread = Math.abs(yDomain[1] - yDomain[0]) || 1;
        var xSpread = Math.abs(xDomain[1] - xDomain[0]) || 1;

        vizGraph.x.domain([xDomain[0] - 0.05 * xSpread, xDomain[1] + 0.05 * xSpread])
        vizGraph.y.domain([yDomain[0] - 0.05 * ySpread, yDomain[1] + 0.05 * ySpread])

        vizGraph.updateAxis()
        vizGraph.updateData({
          'series': [ySpeed, yDeltaTime],
          'index': xTime,
          'thickness': [2, 2],
          'color': [[255, 0, 0], [0, 0, 0]]
        })


      raf(function tick() {
        context.clearRect(0, 0, canvas.width, canvas.height);
        drawPolygon(context, scale(canvas, map.area[0]), {
          fill: '#D6D0C4',
        })

        drawPolygon(context, scale(canvas, map.borders[0]), {
          stroke: '#5e5e5e',
          thickness: 7,
        })

        drawPolygon(context, scale(canvas, map.borders[1]), {
          stroke: '#5e5e5e',
          thickness: 7,
        })

        drawPolygon(context, scale(canvas, map.triggers[0]), {
          fill: '#17B2E6',
        })

        drawPolygon(context, scale(canvas, shift(position, playerShape)), {
          fill: '#AB051E',
        })

        hit.forEach(function (el) {
          el.forEach(function (el) {
            drawPolygon(context, scale(canvas, [el[0], el[1]]), {
              stroke: '#AB051E',
              thickness: 2,
            })
          }) 
        })

        if (results.reward) {
          rewardLED.style.backgroundColor = '#00ff00'
        } else {
          rewardLED.style.backgroundColor = '#000000'
        }
        if (results.response) {
          responseLED.style.backgroundColor = '#ff00ff'
        } else {
          responseLED.style.backgroundColor = '#000000'
        }
        if (results.collision) {
          collisionLED.style.backgroundColor = '#ff0000'
        } else {
          collisionLED.style.backgroundColor = '#000000'
        }

        trialNumEl.innerHTML = 'Trial number: ' + results.trial
        timeEl.innerHTML = 'Time: ' + (results.time/1000).toFixed(1)
        wdL.innerHTML = 'Left wall distance: ' + results.wallLeft.toPrecision(3) + ' mm'
        wdR.innerHTML = 'Right wall distance: ' + results.wallRight.toPrecision(3) + ' mm'
        wdF.innerHTML = 'Forward wall distance: ' + results.wallForward.toPrecision(3) + ' mm'
        speed = (results.velocityForward**2 + results.velocityLateral**2)**(0.5)*50
        speedEl.innerHTML = 'Speed: ' + speed.toFixed(1) + ' cm/s'

        ySpeed.push(speed) 
        yDeltaTime.push(results.deltaTime) 
        xTime.push(results.time/1000)
        yDeltaTime.shift()
        ySpeed.shift()
        xTime.shift()

        // xDomain[0] = -5+results.time/1000
        // xDomain[1] = results.time/1000
        // xSpread = Math.abs(xDomain[1] - xDomain[0]) || 1;
        // vizGraph.x.domain([xDomain[0] - 0.05 * xSpread, xDomain[1] + 0.05 * xSpread])

        // vizGraph.updateAxis()
        // vizGraph.updateData({
        //   'series': [ySpeed, yDeltaTime],
        //   'index': xTime,
        //   'thickness': [2, 2],
        //   'color': [[255, 0, 0], [0, 0, 0]]
        // })

        raf(tick)
      })

      return writer.obj(function (data, enc, callback) {
        position = [data.positionLateral, data.positionForward]
        hit = data.hit
        results = data
        callback()
      })
    },
    updateTrial: function(newMap) {
      map = convertMap(newMap)
    }
  }
}
