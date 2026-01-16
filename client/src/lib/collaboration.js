import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

// Gateway WebSocket URL
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001'

// Room ID stored in module
let currentRoomId = null

// Get room ID from URL or use default
export const getRoomId = () => {
    if (currentRoomId) return currentRoomId
    const params = new URLSearchParams(window.location.search)
    return params.get('room') || null
}

// Set room ID (called when joining a room)
export const setRoomId = (roomId) => {
    currentRoomId = roomId
}

// Singleton Yjs document and provider for the room
let ydoc = null
let provider = null

// Reset Yjs connection (called when switching rooms)
export function resetYjsConnection() {
    if (provider) {
        provider.disconnect()
        provider.destroy()
        provider = null
    }
    if (ydoc) {
        ydoc.destroy()
        ydoc = null
    }
}

// Random animal names for user identity
const ANIMAL_NAMES = [
    'Aardvark', 'Albatross', 'Alligator', 'Alpaca', 'Ant', 'Anteater', 'Antelope', 'Ape', 'Armadillo', 'Donkey',
    'Baboon', 'Badger', 'Barracuda', 'Bat', 'Bear', 'Beaver', 'Bee', 'Bison', 'Boar', 'Buffalo', 'Butterfly',
    'Camel', 'Capybara', 'Caribou', 'Cassowary', 'Cat', 'Caterpillar', 'Cattle', 'Chamois', 'Cheetah', 'Chicken',
    'Chimpanzee', 'Chinchilla', 'Chough', 'Clam', 'Cobra', 'Cockroach', 'Cod', 'Cormorant', 'Coyote', 'Crab',
    'Crane', 'Crocodile', 'Crow', 'Curlew', 'Deer', 'Dinosaur', 'Dog', 'Dogfish', 'Dolphin', 'Dotterel', 'Dove',
    'Dragonfly', 'Duck', 'Dugong', 'Dunlin', 'Eagle', 'Echidna', 'Eel', 'Eland', 'Elephant', 'Elk', 'Emu',
    'Falcon', 'Ferret', 'Finch', 'Fish', 'Flamingo', 'Fly', 'Fox', 'Frog', 'Gaur', 'Gazelle', 'Gerbil',
    'Giraffe', 'Gnat', 'Gnu', 'Goat', 'Goldfinch', 'Goldfish', 'Goose', 'Gorilla', 'Goshawk', 'Grasshopper',
    'Grouse', 'Guanaco', 'Gull', 'Hamster', 'Hare', 'Hawk', 'Hedgehog', 'Heron', 'Herring', 'Hippo', 'Hornet',
    'Horse', 'Human', 'Hummingbird', 'Hyena', 'Ibex', 'Ibis', 'Jackal', 'Jaguar', 'Jay', 'Jellyfish', 'Kangaroo',
    'Kingfisher', 'Koala', 'Kookaburra', 'Kouprey', 'Kudu', 'Lapwing', 'Lark', 'Lemur', 'Leopard', 'Lion',
    'Llama', 'Lobster', 'Locust', 'Loris', 'Louse', 'Lyrebird', 'Magpie', 'Mallard', 'Manatee', 'Mandrill',
    'Mantis', 'Marten', 'Meerkat', 'Mink', 'Mole', 'Mongoose', 'Monkey', 'Moose', 'Mosquito', 'Mouse',
    'Mule', 'Narwhal', 'Newt', 'Nightingale', 'Octopus', 'Okapi', 'Opossum', 'Oryx', 'Ostrich', 'Otter',
    'Owl', 'Oyster', 'Panther', 'Parrot', 'Partridge', 'Peafowl', 'Pelican', 'Penguin', 'Pheasant', 'Pig',
    'Pigeon', 'Pony', 'Porcupine', 'Porpoise', 'Quail', 'Quelea', 'Quetzal', 'Rabbit', 'Raccoon', 'Rail',
    'Ram', 'Rat', 'Raven', 'Red Deer', 'Red Panda', 'Reindeer', 'Rhinoceros', 'Rook', 'Salamander', 'Salmon',
    'Sand Dollar', 'Sandpiper', 'Sardine', 'Scorpion', 'Seahorse', 'Seal', 'Shark', 'Sheep', 'Shrew', 'Skunk',
    'Snail', 'Snake', 'Sparrow', 'Spider', 'Spoonbill', 'Squid', 'Squirrel', 'Starling', 'Stingray', 'Stinkbug',
    'Stork', 'Swallow', 'Swan', 'Tapir', 'Tarsier', 'Termite', 'Tiger', 'Toad', 'Trout', 'Turkey', 'Turtle',
    'Viper', 'Vulture', 'Wallaby', 'Walrus', 'Wasp', 'Weasel', 'Whale', 'Wildcat', 'Wolf', 'Wolverine', 'Wombat',
    'Woodcock', 'Woodpecker', 'Worm', 'Wren', 'Yak', 'Zebra'
]

const USER_COLORS = [
    '#f87171', '#fb923c', '#fbbf24', '#facc15', '#a3e635', '#4ade80', '#34d399', '#2dd4bf',
    '#22d3ee', '#38bdf8', '#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185'
]

// Local user info
let currentUser = null

function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)]
}

export function getYjsDoc() {
    if (!ydoc) {
        ydoc = new Y.Doc()
        const roomId = getRoomId()
        provider = new WebsocketProvider(WS_URL, roomId, ydoc)

        // Generate random user identity if not already set
        if (!currentUser) {
            currentUser = {
                name: getRandomElement(ANIMAL_NAMES),
                color: getRandomElement(USER_COLORS),
                id: Math.floor(Math.random() * 1000000000) // Random session ID
            }
        }

        // Set awareness (user presence)
        if (provider.awareness) {
            provider.awareness.setLocalStateField('user', currentUser)
        }

        provider.on('status', (event) => {
            console.log('[Yjs] Connection status:', event.status)
        })
    }
    return { ydoc, provider }
}

export function getCurrentUser() {
    // Ensure doc is initialized to get a user
    if (!currentUser) {
        getYjsDoc()
    }
    return currentUser
}

export function getSharedOutput() {
    const { ydoc } = getYjsDoc()
    return ydoc.getText('shared-output')
}

// Multi-file support - returns Y.Map<filename, content>
export function getFiles() {
    const { ydoc } = getYjsDoc()
    return ydoc.getMap('files')
}

// Get content for a specific file
export function getFileContent(fileName) {
    const files = getFiles()
    return files.get(fileName) || ''
}

// Set content for a specific file
export function setFileContent(fileName, content) {
    const files = getFiles()
    files.set(fileName, content)
}

// Get all file names
export function getFileNames() {
    const files = getFiles()
    return Array.from(files.keys())
}

// Uploaded files metadata (synced via Yjs)
export function getUploadedFiles() {
    const { ydoc } = getYjsDoc()
    return ydoc.getArray('uploaded-files')
}

// Add an uploaded file record
export function addUploadedFile(fileInfo) {
    const yarray = getUploadedFiles()
    yarray.push([fileInfo])
}

// Remove an uploaded file record
export function removeUploadedFile(fileName) {
    const yarray = getUploadedFiles()
    const items = yarray.toArray()
    const index = items.findIndex(f => f.name === fileName)
    if (index !== -1) {
        yarray.delete(index, 1)
    }
}

// Installed packages for the room (synced via Yjs)
export function getInstalledPackages() {
    const { ydoc } = getYjsDoc()
    return ydoc.getArray('installed-packages')
}

// Add packages with version info: [{name, version}] or [name] (version defaults to 'installed')
export function addInstalledPackages(packages) {
    const yarray = getInstalledPackages()
    const current = yarray.toArray()

    // Normalize packages to objects with name and version
    const normalized = packages.map(pkg => {
        if (typeof pkg === 'string') {
            return { name: pkg, version: 'installed' }
        }
        return pkg
    })

    // Get existing package names for deduplication
    const existingNames = current.map(p => typeof p === 'string' ? p : p.name)

    // Only add packages that aren't already installed
    const newPackages = normalized.filter(pkg => !existingNames.includes(pkg.name))
    if (newPackages.length > 0) {
        yarray.push(newPackages)
    }
}


