import { createRoot } from "react-dom/client";
import { usePartySocket } from "partysocket/react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
	BrowserRouter,
	Routes,
	Route,
	Navigate,
	useParams,
} from "react-router";
import { nanoid } from "nanoid";

import { names, type ChatMessage, type Message } from "../shared";

function App() {
	const [name] = useState(names[Math.floor(Math.random() * names.length)]);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const { room } = useParams();
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const roomCode = useMemo(() => (room ?? "").slice(0, 8).toUpperCase(), [room]);

	useEffect(() => {
		const el = scrollContainerRef.current;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
	}, [messages]);

	const socket = usePartySocket({
		party: "chat",
		room,
		onMessage: (evt) => {
			const message = JSON.parse(evt.data as string) as Message;
			if (message.type === "add") {
				const foundIndex = messages.findIndex((m) => m.id === message.id);
				if (foundIndex === -1) {
					// probably someone else who added a message
					setMessages((messages) => [
						...messages,
						{
							id: message.id,
							content: message.content,
							user: message.user,
							role: message.role,
						},
					]);
				} else {
					// this usually means we ourselves added a message
					// and it was broadcasted back
					// so let's replace the message with the new message
					setMessages((messages) => {
						return messages
							.slice(0, foundIndex)
							.concat({
								id: message.id,
								content: message.content,
								user: message.user,
								role: message.role,
							})
							.concat(messages.slice(foundIndex + 1));
					});
				}
			} else if (message.type === "update") {
				setMessages((messages) =>
					messages.map((m) =>
						m.id === message.id
							? {
									id: message.id,
									content: message.content,
									user: message.user,
									role: message.role,
								}
							: m,
					),
				);
			} else {
				setMessages(message.messages);
			}
		},
	});

	return (
		<div className="app">
			<aside className="intro">
				<div>
					<h1 className="intro-title">
						Pulse <span>Chat</span>
					</h1>
					<p className="intro-description">
						A real-time room powered by Durable Objects. Share your room code,
						start chatting, and watch messages sync instantly for everyone.
					</p>
				</div>
				<div className="meta-list">
					<div className="meta-item">You are signed in as {name}</div>
					<div className="meta-item">Room code: {roomCode}</div>
					<div className="meta-item">Messages in room: {messages.length}</div>
				</div>
			</aside>

			<section className="chat-panel">
				<header className="chat-header">
					<h2 className="chat-title">Live Room</h2>
					<div className="chat-status">Realtime connected</div>
				</header>

				<div className="messages" ref={scrollContainerRef}>
					{messages.length === 0 ? (
						<div className="empty-state">
							No messages yet. Say hi to kick off this room.
						</div>
					) : (
						messages.map((message) => {
							const isMine = message.user === name;
							return (
								<article
									key={message.id}
									className={`message ${isMine ? "mine" : "theirs"}`}
								>
									<div className="message-user">{message.user}</div>
									<div className="message-content">{message.content}</div>
								</article>
							);
						})
					)}
				</div>

				<form
					className="composer"
				onSubmit={(e) => {
					e.preventDefault();
					const content = e.currentTarget.elements.namedItem(
						"content",
					) as HTMLInputElement;
					const text = content.value.trim();
					if (!text) {
						return;
					}
					const chatMessage: ChatMessage = {
						id: nanoid(8),
						content: text,
						user: name,
						role: "user",
					};
					setMessages((messages) => [...messages, chatMessage]);
					// we could broadcast the message here

					socket.send(
						JSON.stringify({
							type: "add",
							...chatMessage,
						} satisfies Message),
					);

					content.value = "";
				}}
				>
					<input
						type="text"
						name="content"
						placeholder={`Say something, ${name}...`}
						autoComplete="off"
					/>
					<button type="submit">Send</button>
				</form>
			</section>
		</div>
	);
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById("root")!).render(
	<BrowserRouter>
		<Routes>
			<Route path="/" element={<Navigate to={`/${nanoid()}`} />} />
			<Route path="/:room" element={<App />} />
			<Route path="*" element={<Navigate to="/" />} />
		</Routes>
	</BrowserRouter>,
);
