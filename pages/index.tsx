import {Chat} from "@/components/Chat/Chat";
import {Navbar} from "@/components/Mobile/Navbar";
import {Sidebar} from "@/components/Sidebar/Sidebar";
import {Conversation, Message, OpenAIModel, OpenAIModelID, OpenAIModels} from "@/types";
import {cleanConversationHistory, cleanSelectedConversation} from "@/utils/app";
import {IconArrowBarLeft, IconArrowBarRight} from "@tabler/icons-react";
import Head from "next/head";
import {useEffect, useState} from "react";

export default function Home() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation>();
    const [loading, setLoading] = useState<boolean>(false);
    const [models, setModels] = useState<OpenAIModel[]>([]);
    const [lightMode, setLightMode] = useState<"dark" | "light">("dark");
    const [messageIsStreaming, setMessageIsStreaming] = useState<boolean>(false);
    const [showSidebar, setShowSidebar] = useState<boolean>(true);
    const [apiKey, setApiKey] = useState<string>("");
    const [messageError, setMessageError] = useState<boolean>(false);
    const [modelError, setModelError] = useState<boolean>(false);

    const noticeDingDing = async (message: string) => {
        const msg = "【ChatUI-通知】" + "\n" + message
        await fetch("https://oapi.dingtalk.com/robot/send?access_token=8a7d4363ac334fed3c92e8d08756ded51916c89ee63c59175e101fd8c4c4464d", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "msgtype": "text",
                "text": {
                    "content": msg
                },
                "at": {
                    "atMobiles": [],
                    "isAtAll": false
                }
            })
        });
    }

    const handleSend = async (message: Message, isResend: boolean) => {
        if (selectedConversation) {
            let updatedConversation: Conversation;

            if (isResend) {
                const updatedMessages = [...selectedConversation.messages];
                updatedMessages.pop();

                updatedConversation = {
                    ...selectedConversation,
                    messages: [...updatedMessages, message]
                };
            } else {
                updatedConversation = {
                    ...selectedConversation,
                    messages: [...selectedConversation.messages, message]
                };
            }

            setSelectedConversation(updatedConversation);
            setLoading(true);
            setMessageIsStreaming(true);
            setMessageError(false);

            const response = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: updatedConversation.model,
                    messages: updatedConversation.messages,
                    key: apiKey
                })
            });

            if (!response.ok) {
                setLoading(false);
                setMessageIsStreaming(false);
                setMessageError(true);
                await noticeDingDing("请求失败：response status：" + response.status)
                return;
            }

            const data = response.body;

            if (!data) {
                setLoading(false);
                setMessageIsStreaming(false);
                setMessageError(true);
                await noticeDingDing("请求失败：无body， response status：" + response.status)
                return;
            }

            setLoading(false);

            const reader = data.getReader();
            const decoder = new TextDecoder();
            let done = false;
            let isFirst = true;
            let text = "";

            while (!done) {
                const {value, done: doneReading} = await reader.read();
                done = doneReading;
                const chunkValue = decoder.decode(value);

                text += chunkValue;

                if (isFirst) {
                    isFirst = false;
                    const updatedMessages: Message[] = [...updatedConversation.messages, {
                        role: "assistant",
                        content: chunkValue
                    }];

                    updatedConversation = {
                        ...updatedConversation,
                        messages: updatedMessages
                    };

                    setSelectedConversation(updatedConversation);
                } else {
                    const updatedMessages: Message[] = updatedConversation.messages.map((message, index) => {
                        if (index === updatedConversation.messages.length - 1) {
                            return {
                                ...message,
                                content: text
                            };
                        }

                        return message;
                    });

                    updatedConversation = {
                        ...updatedConversation,
                        messages: updatedMessages
                    };

                    setSelectedConversation(updatedConversation);
                }
            }

            localStorage.setItem("selectedConversation", JSON.stringify(updatedConversation));

            const updatedConversations: Conversation[] = conversations.map((conversation) => {
                if (conversation.id === selectedConversation.id) {
                    return updatedConversation;
                }

                return conversation;
            });

            if (updatedConversations.length === 0) {
                updatedConversations.push(updatedConversation);
            }

            setConversations(updatedConversations);

            localStorage.setItem("conversationHistory", JSON.stringify(updatedConversations));

            setMessageIsStreaming(false);
        }
    };

    const handleLightMode = (mode: "dark" | "light") => {
        setLightMode(mode);
        localStorage.setItem("theme", mode);
    };

    const handleRenameConversation = (conversation: Conversation, name: string) => {
        const updatedConversation = {
            ...conversation,
            name
        };

        const updatedConversations = conversations.map((c) => {
            if (c.id === updatedConversation.id) {
                return updatedConversation;
            }

            return c;
        });

        setConversations(updatedConversations);
        localStorage.setItem("conversationHistory", JSON.stringify(updatedConversations));

        setSelectedConversation(updatedConversation);
        localStorage.setItem("selectedConversation", JSON.stringify(updatedConversation));
    };

    const handleChangeModel = (conversation: Conversation, model: OpenAIModel) => {
        const updatedConversation = {
            ...conversation,
            model
        };

        const updatedConversations = conversations.map((c) => {
            if (c.id === updatedConversation.id) {
                return updatedConversation;
            }

            return c;
        });

        setConversations(updatedConversations);
        localStorage.setItem("conversationHistory", JSON.stringify(updatedConversations));

        setSelectedConversation(updatedConversation);
        localStorage.setItem("selectedConversation", JSON.stringify(updatedConversation));
    };

    const handleNewConversation = () => {
        const lastConversation = conversations[conversations.length - 1];

        const newConversation: Conversation = {
            id: lastConversation ? lastConversation.id + 1 : 1,
            name: `聊天室 ${lastConversation ? lastConversation.id + 1 : 1}`,
            messages: [],
            model: OpenAIModels[OpenAIModelID.GPT_3_5]
        };

        const updatedConversations = [...conversations, newConversation];
        setConversations(updatedConversations);
        localStorage.setItem("conversationHistory", JSON.stringify(updatedConversations));

        setSelectedConversation(newConversation);
        localStorage.setItem("selectedConversation", JSON.stringify(newConversation));

        setLoading(false);
    };

    const handleSelectConversation = (conversation: Conversation) => {
        setSelectedConversation(conversation);
        localStorage.setItem("selectedConversation", JSON.stringify(conversation));
    };

    const handleDeleteConversation = (conversation: Conversation) => {
        const updatedConversations = conversations.filter((c) => c.id !== conversation.id);
        setConversations(updatedConversations);
        localStorage.setItem("conversationHistory", JSON.stringify(updatedConversations));

        if (updatedConversations.length > 0) {
            setSelectedConversation(updatedConversations[updatedConversations.length - 1]);
            localStorage.setItem("selectedConversation", JSON.stringify(updatedConversations[updatedConversations.length - 1]));
        } else {
            setSelectedConversation({
                id: 1,
                name: "新的聊天",
                messages: [],
                model: OpenAIModels[OpenAIModelID.GPT_3_5]
            });
            localStorage.removeItem("selectedConversation");
        }
    };

    const handleApiKeyChange = (apiKey: string) => {
        setApiKey(apiKey);
        localStorage.setItem("apiKey", apiKey);
    };

    const fetchModels = async (key: string) => {
        const response = await fetch("/api/models", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                key
            })
        });

        if (!response.ok) {
            setModelError(true);
            return;
        }

        const data = await response.json();

        if (!data) {
            setModelError(true);
            return;
        }

        setModels(data);
    };

    useEffect(() => {
        const theme = localStorage.getItem("theme");
        if (theme) {
            setLightMode(theme as "dark" | "light");
        }

        const apiKey = localStorage.getItem("apiKey") || "";

        if (apiKey) {
            setApiKey(apiKey);
        }

        if (window.innerWidth < 640) {
            setShowSidebar(false);
        }

        const conversationHistory = localStorage.getItem("conversationHistory");
        if (conversationHistory) {
            const parsedConversationHistory: Conversation[] = JSON.parse(conversationHistory);
            const cleanedConversationHistory = cleanConversationHistory(parsedConversationHistory);
            setConversations(cleanedConversationHistory);
        }

        const selectedConversation = localStorage.getItem("selectedConversation");
        if (selectedConversation) {
            const parsedSelectedConversation: Conversation = JSON.parse(selectedConversation);
            const cleanedSelectedConversation = cleanSelectedConversation(parsedSelectedConversation);
            setSelectedConversation(cleanedSelectedConversation);
        } else {
            setSelectedConversation({
                id: 1,
                name: "新的聊天",
                messages: [],
                model: OpenAIModels[OpenAIModelID.GPT_3_5]
            });
        }

        fetchModels(apiKey);
    }, []);

    return (
        <>
            <Head>
                <title>Chat Bot</title>
                <meta
                    name="description"
                    content="ChatGPT but better."
                />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                <link
                    rel="icon"
                    href="/favicon.ico"
                />
            </Head>
            {selectedConversation && (
                <div className={`flex flex-col h-screen w-screen text-white ${lightMode}`}>
                    <div className="sm:hidden w-full fixed top-0">
                        <Navbar
                            selectedConversation={selectedConversation}
                            onNewConversation={handleNewConversation}
                        />
                    </div>

                    <div className="flex h-full w-full pt-[48px] sm:pt-0">
                        {showSidebar ? (
                            <>
                                <Sidebar
                                    loading={messageIsStreaming}
                                    conversations={conversations}
                                    lightMode={lightMode}
                                    selectedConversation={selectedConversation}
                                    apiKey={apiKey}
                                    onToggleLightMode={handleLightMode}
                                    onNewConversation={handleNewConversation}
                                    onSelectConversation={handleSelectConversation}
                                    onDeleteConversation={handleDeleteConversation}
                                    onToggleSidebar={() => setShowSidebar(!showSidebar)}
                                    onRenameConversation={handleRenameConversation}
                                    onApiKeyChange={handleApiKeyChange}
                                />

                                <IconArrowBarLeft
                                    className="fixed top-2.5 left-4 sm:top-1 sm:left-4 sm:text-neutral-700 dark:text-white cursor-pointer hover:text-gray-400 dark:hover:text-gray-300 h-7 w-7 sm:h-8 sm:w-8 sm:hidden"
                                    onClick={() => setShowSidebar(!showSidebar)}
                                />
                            </>
                        ) : (
                            <IconArrowBarRight
                                className="fixed top-2.5 left-4 sm:top-1.5 sm:left-4 sm:text-neutral-700 dark:text-white cursor-pointer hover:text-gray-400 dark:hover:text-gray-300 h-7 w-7 sm:h-8 sm:w-8"
                                onClick={() => setShowSidebar(!showSidebar)}
                            />
                        )}

                        <Chat
                            conversation={selectedConversation}
                            messageIsStreaming={messageIsStreaming}
                            modelError={modelError}
                            messageError={messageError}
                            models={models}
                            loading={loading}
                            lightMode={lightMode}
                            onSend={handleSend}
                            onModelChange={handleChangeModel}
                        />
                    </div>
                </div>
            )}
        </>
    );
}
