// Clark Itinerary server (C++17). Serves the website and the itinerary data at /api/itinerary.
// Build (Linux/macOS): g++ -std=c++17 server.cpp -o server
// Build (Windows MinGW): g++ -std=c++17 server.cpp -o server.exe -lws2_32
// Run from this folder, then open http://localhost:8080
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#ifdef _WIN32
  #include <winsock2.h>
  #include <ws2tcpip.h>
  typedef SOCKET sock_t;
  #define CLOSESOCK closesocket
#else
  #include <netinet/in.h>
  #include <sys/socket.h>
  #include <unistd.h>
  typedef int sock_t;
  #define INVALID_SOCKET (-1)
  #define CLOSESOCK close
#endif

struct Stop {
    std::string id, kind, label, time, title, desc, menu, more;
    double lat, lng;
};

// lat/lng are approximate map positions: adjust them here if a pin sits off.
static const std::vector<Stop> ITINERARY = {
    {"A", "letter", "A", "4:15 AM", "Call Time",
     "PLEASE LANG, BAWAL ANG LATE. BWHAHAH!", "", "", 14.685858, 120.538704},
    {"B", "letter", "B", "4:30 AM to 6:30 AM", "Bataan to Clark",
     "", "", "", 15.18583, 120.55972},
    {"1", "number", "1", "6:30 AM to 8:30 AM", "Gogi Marami",
     "First Stop: SAMG na agad, yoohoo!",
     "https://www.facebook.com/story.php?story_fbid=122119413915438124&id=61593143738208&rdid=yT6RS0q2knvxQtKF#",
     "", 15.158364, 120.558891},
    {"2", "number", "2", "8:30 AM to 10:00 AM", "The Ambience (Azzuro Hotel)",
     "Second Stop: Drinks/Coffee, while waiting sa opening ng SM.",
     "https://drive.google.com/drive/folders/1HcI0tZlfyRXu7t4n1MHmCQlmpCo9-xMy?usp=drive_link",
     "https://www.tiktok.com/@sismarsmanganlena/video/7655291279814774036?_r=1&_t=ZS-9ATr8RnQAIm",
     15.164206, 120.590967},
    {"3", "number", "3", "10:00 AM to 12:30 PM", "SM Clark",
     "Ikot ikot, Activities, KTV, Cinema and etc.", "",
     "https://www.tiktok.com/@bacanisam/video/7663080436607798536?_r=1&_t=ZS-9ATrCNXjIEX",
     15.16845, 120.58018},
    {"4", "number", "4", "12:30 PM to 2:00 PM", "The Canyon",
     "Last stop: Drinks or pastries (For clout lang since maganda ang place, bwhaha!)",
     "https://drive.google.com/drive/folders/1KEWTJx0RHiWGakUworNtm2fx1-3qXD41?usp=drive_link",
     "https://www.tiktok.com/@bacanisam/video/7583717210611371265?_r=1&_t=ZS-9AYpl7vAbn3",
     15.1919515, 120.5239687},
    {"C", "letter", "C", "2:00 PM to 6:00 PM", "Clark to Bataan",
     "Depende sa bus schedule :)", "", "", 15.18500, 120.56100},
};

static std::string esc(const std::string& s) {
    std::string o;
    for (char c : s) {
        if (c == '"') o += "\\\"";
        else if (c == '\\') o += "\\\\";
        else if (c == '\n') o += "\\n";
        else o += c;
    }
    return o;
}

static std::string itineraryJson() {
    std::ostringstream j;
    j << std::fixed << std::setprecision(6) << "[";
    for (size_t i = 0; i < ITINERARY.size(); ++i) {
        const Stop& s = ITINERARY[i];
        if (i) j << ",";
        j << "{\"id\":\"" << esc(s.id) << "\",\"kind\":\"" << s.kind << "\",\"label\":\"" << s.label
          << "\",\"time\":\"" << esc(s.time) << "\",\"title\":\"" << esc(s.title)
          << "\",\"desc\":\"" << esc(s.desc) << "\",\"menu\":\"" << esc(s.menu)
          << "\",\"more\":\"" << esc(s.more) << "\",\"lat\":" << s.lat << ",\"lng\":" << s.lng << "}";
    }
    j << "]";
    return j.str();
}

static bool readFile(const std::string& path, std::string& out) {
    std::ifstream f(path, std::ios::binary);
    if (!f) return false;
    std::ostringstream ss;
    ss << f.rdbuf();
    out = ss.str();
    return true;
}

static void sendAll(sock_t s, const std::string& d) {
    size_t off = 0;
    while (off < d.size()) {
        int n = (int)send(s, d.data() + off, (int)(d.size() - off), 0);
        if (n <= 0) break;
        off += (size_t)n;
    }
}

static void respond(sock_t c, int code, const std::string& type, const std::string& body) {
    std::ostringstream h;
    h << "HTTP/1.1 " << code << (code == 200 ? " OK" : " Not Found") << "\r\nContent-Type: " << type
      << "\r\nContent-Length: " << body.size() << "\r\nConnection: close\r\n\r\n";
    sendAll(c, h.str() + body);
}

int main() {
#ifdef _WIN32
    WSADATA w;
    WSAStartup(MAKEWORD(2, 2), &w);
#endif
    sock_t srv = socket(AF_INET, SOCK_STREAM, 0);
    int yes = 1;
    setsockopt(srv, SOL_SOCKET, SO_REUSEADDR, (const char*)&yes, sizeof(yes));
    sockaddr_in a{};
    a.sin_family = AF_INET;
    a.sin_addr.s_addr = htonl(INADDR_ANY);
    a.sin_port = htons(8080);
    if (bind(srv, (sockaddr*)&a, sizeof(a)) < 0 || listen(srv, 16) < 0) {
        std::cerr << "Could not start server on port 8080\n";
        return 1;
    }
    std::cout << "Clark Itinerary running at http://localhost:8080\n";

    for (;;) {
        sock_t c = accept(srv, nullptr, nullptr);
        if (c == INVALID_SOCKET) continue;
        char buf[4096];
        int n = recv(c, buf, sizeof(buf) - 1, 0);
        if (n > 0) {
            buf[n] = 0;
            std::string req(buf);
            size_t p1 = req.find(' '), p2 = req.find(' ', p1 + 1);
            std::string path = (p1 == std::string::npos || p2 == std::string::npos) ? "/" : req.substr(p1 + 1, p2 - p1 - 1);
            size_t q = path.find('?');
            if (q != std::string::npos) path = path.substr(0, q);

            std::string body;
            if (path == "/api/itinerary") respond(c, 200, "application/json; charset=utf-8", itineraryJson());
            else if (path == "/" && readFile("public/index.html", body)) respond(c, 200, "text/html; charset=utf-8", body);
            else if (path == "/style.css" && readFile("public/style.css", body)) respond(c, 200, "text/css; charset=utf-8", body);
            else if (path == "/app.js" && readFile("public/app.js", body)) respond(c, 200, "application/javascript; charset=utf-8", body);
            else if (path == "/canyon.jpg" && readFile("public/canyon.jpg", body)) respond(c, 200, "image/jpeg", body);
            else respond(c, 404, "text/plain", "Not found");
        }
        CLOSESOCK(c);
    }
}
