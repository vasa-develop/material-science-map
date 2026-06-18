import { useMemo, useRef } from "react";
import { Routes, Route, useNavigate, useParams } from "react-router-dom";
import { ROOT } from "./data/map";
import { indexTree, pathTo } from "./lib/tree";
import ZoomStage from "./components/ZoomStage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Explorer />} />
      <Route path="/n/:id" element={<Explorer />} />
    </Routes>
  );
}

function Explorer() {
  const idx = useMemo(() => indexTree(ROOT), []);
  const { id } = useParams();
  const navigate = useNavigate();

  const currentId = id && idx.byId[id] ? id : ROOT.id;
  const node = idx.byId[currentId];
  const path = pathTo(idx, currentId);

  // direction: +1 drilling deeper, -1 climbing out
  const prevIdRef = useRef(currentId);
  const prevDepthRef = useRef(path.length);
  const prevNode = idx.byId[prevIdRef.current];
  const direction = path.length >= prevDepthRef.current ? 1 : -1;

  // the connecting hotspot rect = the *deeper* of the two scenes' originInParent
  const deeper = direction >= 0 ? node : prevNode;
  const focusRect = deeper?.originInParent;

  prevIdRef.current = currentId;
  prevDepthRef.current = path.length;

  const go = (nid: string) => navigate(nid === ROOT.id ? "/" : `/n/${nid}`);

  return (
    <ZoomStage
      node={node}
      path={path}
      direction={direction}
      focusRect={focusRect}
      onNavigate={go}
    />
  );
}
