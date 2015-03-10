all: agml_gui.nw

agml_gui.nw: agml_gui src/css/* src/html/* src/js/*
	@rm -f agml_gui.nw
	cd src; zip -r ../agml_gui.nw ./*

clean:
	rm -f agml_gui.nw


.PHONY: agml_gui.nw