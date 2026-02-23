#include<iostream>
#include<set>
using namespace std;
int glo = 10;
int main(){
    set< int > s;
    for(int i = 0; i < 10; ++i) {
        s.insert(i + 1);
    }
    cout << s.size() << " " << *s.begin() << "\n";

}