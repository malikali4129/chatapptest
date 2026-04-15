import { createRoot } from "react-dom/client";
import { usePartySocket } from "partysocket/react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
	BrowserRouter,
	Navigate,
	Route,
	Routes,
	useLocation,
	useNavigate,
	useParams,
} from "react-router";
import { nanoid } from "nanoid";

import { names, type ChatMessage, type Message } from "../shared";

const NAME_STORAGE_KEY = "pulse-name";

function getFallbackName() {
	return names[Math.floor(Math.random() * names.length)];
}

function getSavedName() {
	const saved = window.sessionStorage.getItem(NAME_STORAGE_KEY);
	if (saved && saved.trim()) {
		return saved.trim();
	}
	return getFallbackName();
}

function buildShareUrl(roomCode: string) {
	return `${window.location.origin}/${roomCode}`;
}

function HomePage() {
	const navigate = useNavigate();
	const [name, setName] = useState(getSavedName);

	const createSession = (event: React.FormEvent) => {
		event.preventDefault();
		const cleanName = name.trim() || getFallbackName();
		window.sessionStorage.setItem(NAME_STORAGE_KEY, cleanName);
		const roomCode = nanoid(8).toLowerCase();
		navigate(`/${roomCode}`, {
			state: { autoJoin: true, suggestedName: cleanName },
		});
	};

	return (
		<main className="shell">
			<section className="card">
				<p className="eyebrow">Realtime Chat</p>
				<h1 className="title">Start a Session</h1>
				<p className="subtitle">
					Create a room, share the URL or QR code, and let others join with their
					own name.
				</p>
				<form className="stack" onSubmit={createSession}>
					<label className="label" htmlFor="home-name">
						Your Name
					</label>
					<input
						id="home-name"
						type="text"
						value={name}
						onChange={(event) => setName(event.currentTarget.value)}
						autoComplete="off"
						required
					/>
					<button type="submit">Create Session</button>
				</form>
			</section>
		</main>
	);
}

function RoomPage() {
	const navigate = useNavigate();
	const location = useLocation();
	const { room } = useParams();
	const roomCode = (room || "").trim().toLowerCase();

	const state = (location.state || {}) as {
		autoJoin?: boolean;
		suggestedName?: string;
	};

	const [name, setName] = useState(() => state.suggestedName || getSavedName());
	const [joined, setJoined] = useState(Boolean(state.autoJoin));

	useEffect(() => {
		if (!roomCode) {
			navigate("/");
		}
	}, [navigate, roomCode]);

	useEffect(() => {
		if (!joined) {
			setName((prev) => prev || getSavedName());
		}
	}, [joined]);

	const joinRoom = (event: React.FormEvent) => {
		event.preventDefault();
		const cleanName = name.trim() || getFallbackName();
		window.sessionStorage.setItem(NAME_STORAGE_KEY, cleanName);
		setName(cleanName);
		setJoined(true);
	};

	if (!joined) {
		return (
			<main className="shell">
				<section className="card">
					<p className="eyebrow">Room {roomCode}</p>
					<h1 className="title">Join Session</h1>
					<p className="subtitle">
						Enter your name to join this room. You will not connect until you
						press Join.
					</p>
					<form className="stack" onSubmit={joinRoom}>
						<label className="label" htmlFor="room-name">
							Your Name
						</label>
						<input
							id="room-name"
							type="text"
							value={name}
							onChange={(event) => setName(event.currentTarget.value)}
							autoComplete="off"
							required
						/>
						<div className="inline-buttons">
							<button type="submit">Join Room</button>
							<button type="button" className="ghost" onClick={() => navigate("/")}>
								Back
							</button>
						</div>
					</form>
				</section>
			</main>
		);
	}

	return <ChatRoom roomCode={roomCode} name={name} onLeave={() => setJoined(false)} />;
}

function ChatRoom(props: { roomCode: string; name: string; onLeave: () => void }) {
	const { roomCode, name, onLeave } = props;
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [feedback, setFeedback] = useState("");
	const messagesRef = useRef<HTMLDivElement>(null);
	const feedbackTimerRef = useRef<number | undefined>(undefined);

	const shareUrl = useMemo(() => buildShareUrl(roomCode), [roomCode]);
	const qrUrl = useMemo(
		() =>
			`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareUrl)}`,
		[shareUrl],
	);

	useEffect(() => {
		return () => {
			if (feedbackTimerRef.current !== undefined) {
				window.clearTimeout(feedbackTimerRef.current);
			}
		};
	}, []);

	useEffect(() => {
		const el = messagesRef.current;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
	}, [messages]);

	const socket = usePartySocket({
		party: "chat",
		room: roomCode,
		onMessage: (evt) => {
			const message = JSON.parse(evt.data as string) as Message;
			if (message.type === "all") {
				setMessages(message.messages);
				return;
			}

			if (message.type === "add") {
				setMessages((existing) => {
					const index = existing.findIndex((m) => m.id === message.id);
					if (index === -1) {
						return [
							...existing,
							{
								id: message.id,
								content: message.content,
								user: message.user,
								role: message.role,
							},
						];
					}
					return existing
						.slice(0, index)
						.concat({
							id: message.id,
							content: message.content,
							user: message.user,
							role: message.role,
						})
						.concat(existing.slice(index + 1));
				});
				return;
			}

			setMessages((existing) =>
				existing.map((m) =>
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
		},
	});

	const sendMessage = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const input = event.currentTarget.elements.namedItem(
			"content",
		) as HTMLInputElement;
		const text = input.value.trim();
		if (!text) return;

		const chatMessage: ChatMessage = {
			id: nanoid(8),
			content: text,
			user: name,
			role: "user",
		};

		setMessages((existing) => [...existing, chatMessage]);
		socket.send(
			JSON.stringify({
				type: "add",
				...chatMessage,
			} satisfies Message),
		);

		input.value = "";
	};

	const setFeedbackTimed = (text: string) => {
		setFeedback(text);
		if (feedbackTimerRef.current !== undefined) {
			window.clearTimeout(feedbackTimerRef.current);
		}
		feedbackTimerRef.current = window.setTimeout(() => {
			setFeedback("");
		}, 2200);
	};

	const shareRoom = async () => {
		try {
			if (navigator.share) {
				await navigator.share({
					title: "Chat Session",
					text: `Join my room: ${roomCode}`,
					url: shareUrl,
				});
				setFeedbackTimed("Shared.");
				return;
			}
			await navigator.clipboard.writeText(shareUrl);
			setFeedbackTimed("Link copied.");
		} catch {
			setFeedbackTimed("Share failed.");
		}
	};

	return (
		<main className="chat-shell">
			<section className="sidebar">
				<p className="eyebrow">Session</p>
				<h2 className="title-small">{roomCode}</h2>
				<p className="subtitle">Joined as {name}</p>
				<div className="share-box">
					<p className="label">Invite URL</p>
					<a href={shareUrl}>{shareUrl}</a>
					<img src={qrUrl} alt="Room QR Code" />
					<div className="inline-buttons">
						<button type="button" onClick={shareRoom}>
							Share
						</button>
						<button type="button" className="ghost" onClick={onLeave}>
							Leave
						</button>
					</div>
					{feedback ? <p className="feedback">{feedback}</p> : null}
				</div>
			</section>

			<section className="chat-panel">
				<div className="messages" ref={messagesRef}>
					{messages.length === 0 ? (
						<p className="empty">No messages yet.</p>
					) : (
						messages.map((message) => {
							const mine = message.user === name;
							return (
								<article key={message.id} className={`msg ${mine ? "mine" : "theirs"}`}>
									<p className="msg-user">{message.user}</p>
									<p className="msg-body">{message.content}</p>
								</article>
							);
						})
					)}
				</div>
				<form className="composer" onSubmit={sendMessage}>
					<input
						type="text"
						name="content"
						placeholder="Write a message"
						autoComplete="off"
					/>
					<button type="submit">Send</button>
				</form>
			</section>
		</main>
	);
}

createRoot(document.getElementById("root")!).render(
	<BrowserRouter>
		<Routes>
			<Route path="/" element={<HomePage />} />
			<Route path="/:room" element={<RoomPage />} />
			<Route path="*" element={<Navigate to="/" />} />
		</Routes>
	</BrowserRouter>,
);
