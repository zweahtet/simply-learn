// simply-learn/client/src/app/(auth)/login/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { LoginForm } from '@/components/Login';

export default function LoginPage() {
    const router = useRouter();

    return (
        <div className='container mx-auto py-8 px-4'>
            <LoginForm
                onRegisterClick={() => router.push('/register')}
            />
        </div>
    )
}