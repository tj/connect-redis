
index.html: index.js
	dox --title "Connect Redis" \
		--ribbon "http://github.com/visionmedia/connect-redis" \
		$< > $@
