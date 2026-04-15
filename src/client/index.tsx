import { createRoot } from "react-dom/client";
import { usePartySocket } from "partysocket/react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
	BrowserRouter,
	Routes,
	Route,
	Navigate,
	useParams,
	useNavigate,
} from "react-router";
import { nanoid } from "nanoid";

import { names, type ChatMessage, type Message } from "../shared";

function App() {
	const navigate = useNavigate();
	const [seedName] = useState(() => names[Math.floor(Math.random() * names.length)]);
	const [draftName, setDraftName] = useState(seedName);
	const [activeName, setActiveName] = useState("");
	const [draftRoom, setDraftRoom] = useState("");
	const [hasEntered, setHasEntered] = useState(false);
	const [shareFeedback, setShareFeedback] = useState("");
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const { room } = useParams();
	const activeRoom = room ?? "";
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const roomCode = useMemo(() => activeRoom.slice(0, 8).toUpperCase(), [activeRoom]);
	const shareTimerRef = useRef<number | undefined>(undefined);

	useEffect(() => {
		setDraftRoom(activeRoom);
	}, [activeRoom]);

	useEffect(() => {
		setMessages([]);
	}, [activeRoom]);

	useEffect(() => {
		const el = scrollContainerRef.current;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
	}, [messages]);

	useEffect(() => {
		return () => {
			if (shareTimerRef.current !== undefined) {
				window.clearTimeout(shareTimerRef.current);
			}
		};
	}, []);

	const setTimedFeedback = (message: string) => {
		setShareFeedback(message);
		if (shareTimerRef.current !== undefined) {
			window.clearTimeout(shareTimerRef.current);
		}
		shareTimerRef.current = window.setTimeout(() => {
			setShareFeedback("");
		}, 2600);
	};

	const getShareLink = (roomId: string) => {
		if (!roomId) return "";
		return `${window.location.origin}/${roomId}`;
	};

	const shareInvite = async (roomId: string) => {
		const roomIdTrimmed = roomId.trim();
		if (!roomIdTrimmed) {
			setTimedFeedback("Add a room code to share an invite.");
			return;
		}

		const shareLink = getShareLink(roomIdTrimmed);
		try {
			if (navigator.share) {
				await navigator.share({
					title: "Pulse Chat Invite",
					text: `Join my room on Pulse Chat: ${roomIdTrimmed}`,
					url: shareLink,
				});
				setTimedFeedback("Invite shared.");
				return;
			}

			await navigator.clipboard.writeText(shareLink);
			setTimedFeedback("Invite link copied to clipboard.");
		} catch {
			setTimedFeedback("Could not share invite in this browser.");
		}
	};

	const launchSession = () => {
		const cleanedName = draftName.trim() || seedName;
		const generatedRoom = nanoid(10);
		setDraftRoom(generatedRoom);
		setActiveName(cleanedName);
		setHasEntered(true);
		navigate(`/${generatedRoom}`);
	};

	const joinSession = () => {
		const cleanedName = draftName.trim() || seedName;
		const cleanedRoom = draftRoom.trim();
		if (!cleanedRoom) {
			setTimedFeedback("Enter a room code to join, or use Launch Session.");
			return;
		}

		setActiveName(cleanedName);
		setHasEntered(true);
		if (cleanedRoom !== activeRoom) {
			navigate(`/${cleanedRoom}`);
		}
	};

	const socket = usePartySocket({
		party: "chat",
		room: hasEntered ? activeRoom : undefined,
		onMessage: (evt) => {
			if (!hasEntered) return;
			const message = JSON.parse(evt.data as string) as Message;
			if (message.type === "add") {
				setMessages((previous) => {
					const foundIndex = previous.findIndex((m) => m.id === message.id);
					if (foundIndex === -1) {
						return [
							...previous,
							{
								id: message.id,
								content: message.content,
								user: message.user,
								role: message.role,
							},
						];
					}

					return previous
						.slice(0, foundIndex)
						.concat({
							id: message.id,
							content: message.content,
							user: message.user,
							role: message.role,
						})
						.concat(previous.slice(foundIndex + 1));
				});
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

	if (!hasEntered) {
		return (
			<div className="launch-screen">
				<div className="launch-grid" aria-hidden="true" />
				<section className="launch-shell">
					<p className="launch-kicker">NEURAL ROOM INTERFACE</p>
					<h1 className="launch-title">
						Pulse <span>Portal</span>
					</h1>
					<p className="launch-subtitle">
						Start from this home screen, set your identity, then launch a new
						session or join an existing room code.
					</p>

					<form
						className="launch-form"
						onSubmit={(event) => {
							event.preventDefault();
							joinSession();
						}}
					>
						<label className="launch-label" htmlFor="display-name">
							Display Name
						</label>
						<input
							id="display-name"
							name="display-name"
							type="text"
							value={draftName}
							onChange={(event) => setDraftName(event.currentTarget.value)}
							autoComplete="off"
							required
						/>

						<label className="launch-label" htmlFor="room-code">
							Room Code
						</label>
						<input
							id="room-code"
							name="room-code"
							type="text"
							value={draftRoom}
							onChange={(event) => setDraftRoom(event.currentTarget.value)}
							autoComplete="off"
							placeholder="Enter code to join an existing room"
						/>
						<p className="launch-hint">
							No room code yet? Use Launch Session to create one.
						</p>

						<div className="launch-actions">
							<button type="button" onClick={launchSession}>
								Launch Session
							</button>
							<button type="submit" className="ghost">
								Join Session
							</button>
							<button
								type="button"
								className="ghost subtle"
								onClick={() => shareInvite(draftRoom)}
							>
								Share Invite
							</button>
						</div>
					</form>
					{shareFeedback ? (
						<p className="share-feedback">{shareFeedback}</p>
					) : null}
				</section>
			</div>
		);
	}

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
					<div className="meta-item">You are signed in as {activeName}</div>
					<div className="meta-item">Room code: {roomCode}</div>
					<div className="meta-item">Messages in room: {messages.length}</div>
					<div className="meta-item">Share link: {getShareLink(activeRoom)}</div>
				</div>
			</aside>

			<section className="chat-panel">
				<header className="chat-header">
					<div>
						<h2 className="chat-title">Live Room</h2>
						<div className="chat-status">Realtime connected</div>
					</div>
					<button
						type="button"
						className="share-room-button"
						onClick={() => shareInvite(activeRoom)}
					>
						Share
					</button>
				</header>

				<div className="messages" ref={scrollContainerRef}>
					{messages.length === 0 ? (
						<div className="empty-state">
							No messages yet. Say hi to kick off this room.
						</div>
					) : (
						messages.map((message) => {
							const isMine = message.user === activeName;
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
							user: activeName,
							role: "user",
						};
						setMessages((messages) => [...messages, chatMessage]);

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
						placeholder={`Say something, ${activeName}...`}
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
			<Route path="/" element={<App />} />
			<Route path="/:room" element={<App />} />
			<Route path="*" element={<Navigate to="/" />} />
		</Routes>
	</BrowserRouter>,
);
