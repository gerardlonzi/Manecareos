"use client";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/card";

const CandidateMap = dynamic(() => import("./candidate-map"), { ssr: false, loading: () => <Skeleton className="h-[28rem]" /> });
export default CandidateMap;
