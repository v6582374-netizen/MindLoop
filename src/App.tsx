import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Library from "./pages/Library";
import Tasks from "./pages/Tasks";
import Review from "./pages/Review";
import Archives from "./pages/Archives";
import Settings from "./pages/Settings";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="library" element={<Library />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="review" element={<Review />} />
        <Route path="archives" element={<Archives />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;
