var express = require('express');
var RedisStore = require('connect-redis')(express);
var LastFmNode = require('lastfm').LastFmNode;

var lastfm = new LastFmNode({
	api_key: '',
	secret: '',
	useragent: 'FriendScrobbler/v0.2'
});

var app = express.createServer(express.logger());
app.use(express.cookieParser());
app.use(express.session({cookie: { path: '/', httpOnly: true, maxAge: 31556926000 }, secret: 'scr000bble', store: new RedisStore }));
app.use(express.bodyParser());

app.listen(8374, function() {
	console.log("Listening on " + 8374);
});

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res) {

	res.render('index', { locals: {
	    fromuser : req.session.fromuser,
	    user : req.session.user
	}});

});

app.get('/scrobbler', function(req, res) {

	if (!req.session.key || !req.session.user || !req.session.fromuser) {
		res.redirect('/');
		return;
	}

	res.render('scrobbler', { locals: {
	    fromuser : req.session.fromuser,
	    user : req.session.user
	}});

});

app.post('/now_playing', function(req, res) {

	if (!req.session.key || !req.session.user || !req.session.fromuser) {
		res.json({ success : false, error : 'not authorized with friendscrobbler, try reload' })
		return;
	}

	lastfm.request("track.getInfo", { track: req.body.song, artist: req.body.artist,
	    handlers: {
	        success: function(data) {
				lastfm.update('nowplaying', lastfm.session(req.session.user, req.session.key), { track: req.body.song, artist: req.body.artist, duration: data.track.duration });
				res.json({ success : true, duration : data.track.duration });
	        }
	    }
	});

});

app.post('/scrobble', function(req, res) {

	if (!req.session.key || !req.session.user || !req.session.fromuser) {
		res.json({ error : 'not authorized' })
		return;
	}
	var session = lastfm.session(req.session.user, req.session.key);

	lastfm.update('scrobble', session, { track: req.body.song, artist: req.body.artist, timestamp: Math.round(new Date().getTime() / 1000),
	    handlers: {
	        success: function(data) {
	            console.log("Scrobble Success: " + data);
				res.json({ success : true });
	        },
	        error: function(error) {
	            console.log("Scrobble Error: " + error.message);
				res.json({ success : false, error : error.message });
	        }
	    }
	});

});

app.post('/auth', function(req, res) {

	req.session.fromuser = req.body.fromuser;

	if (!req.session.key || !req.session.user) {
		res.redirect('http://www.last.fm/api/auth/?api_key=' + lastfm.api_key);
	} else {
		res.redirect('/scrobbler');
	}

});

app.get('/auth', function(req, res) {

	var session = lastfm.session();

	session.authorise(req.query.token, {
		handlers: {
			authorised: function(session) {
				req.session.key = session.key;
				req.session.user = session.user;
				res.redirect('/scrobbler');
			}
		}
	});

});

app.get('/de-auth', function(req, res) {
	req.session.destroy();
	res.redirect('/');
});