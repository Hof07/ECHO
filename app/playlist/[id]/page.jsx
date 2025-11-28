// 🛑 IMPORTANT: Assuming your main component is in the same directory, 
// if not, adjust the import path. If you are using your provided code
// directly in this file, you still only need to export the function once.

import PlaylistPage from './PlaylistPage'; // Adjust path if necessary

export default function PlaylistRoutePage() {
    // This is where you pass any props needed, but since PlaylistPage
    // uses useParams(), it doesn't need them.
    return (
        <PlaylistPage />
    );
}
// If the code you provided IS this file, just ensure the export is correct:
// export default function PlaylistPage() { ... }