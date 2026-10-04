import { Home } from './pages/Home';
import { PCSearchProvider } from './hooks/usePCSearch';
import { BooksProvider } from './hooks/useBooks';

// CustomizationProvider deliberately isn't here any more: it talks to
// Firestore, which only the 3D room needs, so it lives inside RoomView and
// loads with that chunk. See components/RoomView.tsx.
function App() {
  return (
    <BooksProvider>
      <PCSearchProvider>
        <Home />
      </PCSearchProvider>
    </BooksProvider>
  );
}

export default App;
