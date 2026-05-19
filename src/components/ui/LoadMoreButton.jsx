import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, Loader2 } from "lucide-react";

// Componente de "Carregar Mais" para paginação infinita
export const LoadMoreButton = ({ onLoadMore, hasMore, isLoading }) => {
  if (!hasMore) return null;
  
  return (
    <div className="flex justify-center mt-4">
      <Button
        variant="outline"
        onClick={onLoadMore}
        disabled={isLoading}
        className="gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando...
          </>
        ) : (
          <>
            <ChevronDown className="w-4 h-4" />
            Carregar mais
          </>
        )}
      </Button>
    </div>
  );
};

LoadMoreButton.displayName = "LoadMoreButton";