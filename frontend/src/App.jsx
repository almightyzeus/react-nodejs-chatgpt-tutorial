import { useState,useRef } from "react";
import "./App.css";

function App() {
  const [message, setMessage] = useState("");
  const [chats, setChats] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);

  const chat = async (e, message) => {
    e.preventDefault();

    if (!message) return;
    setIsTyping(true);
    scrollTo(0, 1e10);

    let msgs = chats;
    msgs.push({ role: "user", content: message });
    setChats(msgs);

    setMessage("");

    try {
      const response = await fetch("http://localhost:8000/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chats,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch data (HTTP ${response.status})`);
      }

      const data = await response.json();

      msgs.push(data.output);
      setChats(msgs);
      setIsTyping(false);
      scrollTo(0, 1e10);
    } catch (error) {
      console.error("Error processing request:", error);

      // Handle the error gracefully by displaying a generic message
      msgs.push({ role: "system", content: "Oops! Something went wrong. Please try again." });
      setChats(msgs);
      setIsTyping(false);
      scrollTo(0, 1e10);
    }
  };

  const sendFilesToBackend = async () => {
    if (files.length === 0) return;
    // Your code to send files to the backend
    // You can use the FormData API to create a form data object
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });
    setIsLoading(true); // Set loading state to true
    
    // Use fetch or another API library to send the form data to the backend
    try {
      const response = await fetch("http://localhost:8000/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to upload files (HTTP ${response.status})`);
      }

      const data = await response.json();
      console.log("Files uploaded successfully:", data);
      console.log("Files uploaded successfully:", files);
      setFiles([]); // Clear the files after uploading
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setIsLoading(false); 
    } catch (error) {
      console.error("Error uploading files:", error);
      setIsLoading(false); 
    }
  };

  const handleFileChange = (e) => {
    const selectedFiles = e.target.files;

    // Filter only PDF files
    const pdfFiles = Array.from(selectedFiles).filter((file) =>
      file.type === "application/pdf"
    );

    setFiles(pdfFiles);
  };

  return (
    <main>
      <h1>Custom AI Chatbot</h1>

      <section className="chat-section">
        {chats && chats.length
          ? chats.map((chat, index) => (
              <p key={index} className={chat.role === "user" ? "user_msg" : ""}>
                <span>
                  <b>{chat.role.toUpperCase()}</b>
                </span>
                <span>:</span>
                <span>{chat.content}</span>
              </p>
            ))
          : ""}
      </section>

      <div className={isTyping ? "" : "hide"}>
        <p>
          <i>{isTyping ? "Typing" : ""}</i>
        </p>
      </div>

      <div className={isLoading ? "loading-mask" : "hide"}>
      <p>
        <i>Processing PDFs and generating embedding data...</i>
      </p>
    </div>

      <form action="" onSubmit={(e) => chat(e, message)}>
        <input
          type="text"
          name="message"
          value={message}
          placeholder="Type a message here and hit Enter..."
          onChange={(e) => setMessage(e.target.value)}
        />
        <input type="file" name="files" onChange={handleFileChange} accept=".pdf" multiple  ref={fileInputRef} />
        <button onClick={() => sendFilesToBackend()}>Upload File</button>
        <button type="submit">Send</button>
      </form>
    </main>
  );
}

export default App;
