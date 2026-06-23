import ImageNode from "./ImageNode";
import VideoNode from "./VideoNode";
import NoteNode from "./NoteNode";
import AssetNode from "./AssetNode";
import ImageSourceNode from "./ImageSourceNode";
import VideoSourceNode from "./VideoSourceNode";
import StartEndVideoNode from "./StartEndVideoNode";

export const nodeTypes = {
  noteNode: NoteNode,
  imageNode: ImageNode,
  videoNode: VideoNode,
  assetNode: AssetNode,
  imageSource: ImageSourceNode,
  videoSource: VideoSourceNode,
  startEndVideo: StartEndVideoNode,
};

export { default as ImageNode } from "./ImageNode";
export { default as VideoNode } from "./VideoNode";
export { default as NoteNode } from "./NoteNode";
export { default as AssetNode } from "./AssetNode";
export { default as ImageSourceNode } from "./ImageSourceNode";
export { default as VideoSourceNode } from "./VideoSourceNode";
export { default as StartEndVideoNode } from "./StartEndVideoNode";
