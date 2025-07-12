import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { Button } from './components/ui/button.tsx';



function App() {
  return (
    <>
	 	<Button variant="default">Button</Button>
	 	<Button variant="secondary">Button</Button>
	 	<Button variant="outline">Button</Button>
	 	<Button variant="destructive">Button</Button>
	 	<Button variant="ghost">Button</Button>
	 	<Button variant="link">Button</Button>
    </>
  )
}

export default App
