package main

import (
	"log"

	"github.com/damonrock/guitar-desktop/internal/app"
	"github.com/damonrock/guitar-desktop/internal/engine"
	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
)

func main() {
	audioEngine, err := engine.NewNative("")
	if err != nil {
		log.Fatal(err)
	}
	a := app.New(audioEngine)
	pollDone := make(chan struct{})
	mygo.App.OnWillQuit(func(*mygo.QuitEvent) {
		close(pollDone)
		if err := audioEngine.Close(); err != nil {
			log.Printf("close audio engine: %v", err)
		}
	})
	mygo.App.WhenReady(func() {
		window := mygo.NewWindow(mygo.WindowOptions{
			Title:     "Guitar Effects",
			Width:     960,
			Height:    640,
			MinWidth:  640,
			MinHeight: 480,
			StateKey:  "main",
			Content:   ui.View(a.View),
		})
		a.SetWindow(window)
		a.StartPolling(pollDone)
	})
	if err := mygo.App.Run(); err != nil {
		log.Fatal(err)
	}
}
