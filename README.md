## Inspiration

Virginia Tech’s motto, **Ut Prosim — That I May Serve**, is built around the idea that everyone has something valuable to contribute. We wanted to explore what that could look like as a digital community.

VOLGO is a time-banking platform that helps people exchange skills and time instead of money. Someone might need help understanding calculus, moving furniture, setting up Linux, or reviewing a resume. Someone else nearby may already have the exact skill and an hour to spare.

The problem is that those two people rarely find each other.

VOLGO is designed to close that gap.

## What it does

VOLGO lets users describe what they need or what they can offer in plain language.

Instead of filling out a long form, someone can write:

> “I’m free Saturday afternoon and can help with Java or Linux.”

or:

> “I need help moving a desk this weekend.”

Gemini organizes that input into a structured request or offer, identifying useful details such as skills, availability, and estimated time. If the request is too vague, VOLGO can ask for the missing information before publishing it.

Once posted, users can browse the community through a personalized discovery page. VOLGO ranks opportunities based on the skills and needs already associated with a user and highlights strong matches.

Users can then express interest, accept a connection, privately exchange contact information, and coordinate the service.

After the work is finished, **both participants must independently confirm that the exchange happened**. Only then are the hours counted as verified service.

The person who provided the help earns time credits, while both participants receive a permanent record of the completed exchange.

## Proof of service with Solana

We wanted blockchain to solve a real trust problem instead of simply adding a token to the project.

Once both people verify a completed exchange, VOLGO creates a privacy-preserving audit receipt and publishes it to **Solana Devnet**.

The receipt contains the duration and completion time along with cryptographic commitments representing the participants. Their Clerk IDs, names, contact information, and original posts are never placed on-chain.

Anyone can use VOLGO’s public verification page to inspect a receipt and verify that the service record corresponds to a confirmed Solana transaction.

This creates a public **proof of service** without creating a public record of who needed help.

## AI that stays out of the way

We did not want VOLGO to feel like another chatbot.

Gemini works primarily behind the interface:

- It converts natural-language offers and requests into structured posts.
- It asks concise clarification questions when a post is missing important information.
- During onboarding, users can optionally upload a resume and have Gemini draft a service-focused bio, skills, and interests for them to review.
- The original resume is not retained after processing.

The goal is to reduce friction while keeping the actual experience centered around people helping people.

## How we built it

VOLGO is built as a full-stack TypeScript application using **TanStack Start** and React.

**MongoDB Atlas** serves as the operational database for user profiles, requests, offers, matches, notifications, exchanges, and service history.

**Clerk** provides authentication, including a Virginia Tech-focused Google sign-in flow.

**Gemini** is integrated through TanStack AI and produces structured outputs for intent classification and profile generation.

Our matching system scores community opportunities using the relationship between offers and requests, shared skills, and expected time commitments.

The frontend uses **Tailwind CSS, shadcn, Motion, and TanStack Router** to create a responsive interface with animated state transitions rather than a traditional form-heavy volunteer portal.

For verified exchanges, VOLGO generates a hashed audit receipt and submits it through the Solana Memo program. Users can inspect confirmed receipts through a public audit page.

## Challenges we faced

One of our biggest challenges was deciding what should and should not live on the blockchain.

Putting user profiles, requests, or identities on-chain would have created unnecessary privacy concerns. We instead designed Solana as an audit layer that only becomes involved after an exchange is independently confirmed by both participants.

Another challenge was making AI feel useful without allowing it to control the platform. Gemini helps interpret what users mean, but people still review their posts, decide who they want to work with, and confirm whether service actually occurred.

We also had to think carefully about the lifecycle of a real-world exchange: publishing a request, expressing interest, accepting a match, revealing contact information, completing the work, getting confirmation from both sides, awarding credit, and finally producing a verifiable receipt.

## What we learned

The most important thing we learned was that trust systems do not have to expose more information in order to become more verifiable.

By separating operational data in MongoDB from cryptographic audit data on Solana, we were able to preserve a normal consumer experience while still creating independently verifiable service records.

We also learned that generative AI can be most useful when it is almost invisible. Instead of making users learn how to prompt a chatbot, VOLGO lets them describe what they need naturally and handles the structure behind the scenes.

## What's next

We would like to continue improving the matching system so VOLGO can better understand related skills rather than relying primarily on direct skill overlap.

We also see VOLGO expanding beyond a single campus into a portable community service network where verified time, reputation, and contributions can move with a person between schools, neighborhoods, and organizations.

At its core, the idea remains simple:

**Everyone has time, knowledge, or a skill that can help someone else. VOLGO makes it easier to put that time to work.**
