import { useState } from 'react'
import { useFrappeGetCall, useFrappePrefetchGetCall } from './lib'

function App() {
  const [count, setCount] = useState(0)

  const [mounted, setMounted] = useState(false)

  const preload = useFrappePrefetchGetCall('ping')

  const onClick = () => {
    // Try prefetching here
    preload()

    setTimeout(() => {
      setMounted(true)
    }, 3000)
  }

  return (
    <div className="App">
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src="/vite.svg" className="logo" alt="Vite logo" />
        </a>
        <a href="https://reactjs.org" target="_blank">
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={onClick}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
      {mounted && <FetchingComponent />}
    </div>
  )
}


const FetchingComponent = () => {

  const {data} = useFrappeGetCall('ping')

  return <div>{data?.message}</div>

}
export default App
