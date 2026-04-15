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

const NAME_STORAGE_KEY = "pulse-display-name";

function getStoredName() {
	const stored = window.sessionStorage.getItem(NAME_STORAGE_KEY);
	if (stored && stored.trim()) {
		return stored.trim();
	}
	return names[Math.floor(Math.random() * names.length)];
}

function shareLink(roomId: string) {
	return `${window.location.origin}/${roomId}`;
}

function HomePage() {
	const navigate = useNavigate();
	const [seedName] = useState(getStoredName);
	const [draftName, setDraftName] = useState(seedName);
	const [draftRoom, setDraftRoom] = useState("");
	const [shareFeedback, setShareFeedback] = useState("");
	const shareTimerRef = useRef<number | undefined>(undefined);

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

	const shareInvite = async (roomId: string) => {
		const roomIdTrimmed = roomId.trim();
		if (!roomIdTrimmed) {
			setTimedFeedback("Add a room code to share an invite.");
			return;
		}

		const inviteUrl = shareLink(roomIdTrimmed);
		try {
			if (navigator.share) {
				await navigator.share({
					title: "Pulse Chat Invite",
					text: `Join my room on Pulse Chat: ${roomIdTrimmed}`,
					url: inviteUrl,
				});
				setTimedFeedback("Invite shared.");
				return;
			}

			await navigator.clipboard.writeText(inviteUrl);
			setTimedFeedback("Invite link copied to clipboard.");
		} catch {
			setTimedFeedback("Could not share invite in this browser.");
		}
	};

	const launchSession = () => {
		const cleanedName = draftName.trim() || seedName;
		const generatedRoom = nanoid(10);
		window.sessionStorage.setItem(NAME_STORAGE_KEY, cleanedName);
		navigate(`/${generatedRoom}`);
	};

	const joinSession = () => {
		const cleanedName = draftName.trim() || seedName;
		const cleanedRoom = draftRoom.trim();
		if (!cleanedRoom) {
			setTimedFeedback("Enter a room code to join, or use Launch Session.");
			return;
		}

		window.sessionStorage.setItem(NAME_STORAGE_KEY, cleanedName);
		navigate(`/${cleanedRoom}`);
	};

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
				{shareFeedback ? <p className="share-feedback">{shareFeedback}</p> : null}
			</section>
		</div>
	);
}

function RoomPage() {
	const navigate = useNavigate();
	const { room } = useParams();
	const activeRoom = room ?? "";
	const activeName = useMemo(getStoredName, []);
	const [shareFeedback, setShareFeedback] = useState("");
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const shareTimerRef = useRef<number | undefined>(undefined);
	const roomCode = useMemo(() => activeRoom.slice(0, 8).toUpperCase(), [activeRoom]);

	useEffect(() => {
		if (!activeRoom) {
			navigate("/");
			return;
		}
		setMessages([]);
	}, [activeRoom, navigate]);

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

	const shareInvite = async () => {
		if (!activeRoom) return;
		const inviteUrl = shareLink(activeRoom);
		try {
			if (navigator.share) {
				await navigator.share({
					title: "Pulse Chat Invite",
					text: `Join my room on Pulse Chat: ${activeRoom}`,
					url: inviteUrl,
				});
				setTimedFeedback("Invite shared.");
				return;
			}

			await navigator.clipboard.writeText(inviteUrl);
			setTimedFeedback("Invite link copied to clipboard.");
		} catch {
			setTimedFeedback("Could not share invite in this browser.");
		}
	};

	const socket = usePartySocket({
		party: "chat",
		room: activeRoom,
		onMessage: (evt) => {
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
					<div className="meta-item">You are signed in as {activeName}</div>
					<div className="meta-item">Room code: {roomCode}</div>
					<div className="meta-item">Messages in room: {messages.length}</div>
					<div className="meta-item">Share link: {shareLink(activeRoom)}</div>
					<div className="meta-item">
						<button
							type="button"
							className="share-room-button"
							onClick={shareInvite}
						>
							Share Invite
						</button>
					</div>
					{shareFeedback ? <div className="meta-item">{shareFeedback}</div> : null}
				</div>
			</aside>

			<section className="chat-panel">
				<header className="chat-header">
					<div>
						<h2 className="chat-title">Live Room</h2>
						<div className="chat-status">Realtime connected</div>
					</div>
					<button type="button" className="share-room-button" onClick={shareInvite}>
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
			<Route path="/" element={<HomePage />} />
			<Route path="/:room" element={<RoomPage />} />
			<Route path="*" element={<Navigate to="/" />} />
		</Routes>
	</BrowserRouter>,
);
