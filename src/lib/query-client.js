import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			staleTime: 60_000,       // 1 minuto — evita refetch desnecessário
			gcTime: 10 * 60_000,     // cache mantido por 10 min
		},
	},
});