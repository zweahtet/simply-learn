// simply-learn/client/src/app/(public)/page.tsx
import { Metadata } from 'next';
import { Welcome } from '@/components/Welcome';

export const metadata: Metadata = {
	title: "EquiLearn - Personalized Learning for ESL Students",
	description:
		"AI-powered educational content adaptation that matches your unique cognitive style and language level.",
	keywords:
		"education, learning, ESL, personalized learning, AI education, cognitive profile",
	openGraph: {
		title: "EquiLearn - Personalized Learning for ESL Students",
		description:
			"AI-powered educational content adaptation that matches your unique cognitive style and language level.",
		images: [
			{
				url: "/og-image.jpg",
				width: 1200,
				height: 630,
				alt: "EquiLearn",
			},
		],
	},
};

export default function HomePage() {
    return <Welcome />;
}